-- Friendship consent hardening
--
-- The original table policies allowed any authenticated requester to insert a
-- pending row without consulting the addressee's privacy settings or either
-- user's block list. They also allowed the requester to update that same row
-- to `accepted`. Move every friendship state transition behind a narrow,
-- server-owned API and remove direct mutation privileges from app clients.

-- There must be at most one relationship row for an unordered pair. The old
-- directed UNIQUE(requester_id, addressee_id) still allowed A->B and B->A to
-- race into separate rows. Fail loudly instead of deleting production data if
-- historical reverse duplicates need manual reconciliation.
do $$
begin
  if exists (
    select 1
    from public.friendships a
    join public.friendships b
      on b.requester_id = a.addressee_id
     and b.addressee_id = a.requester_id
     and b.id > a.id
  ) then
    raise exception
      'Cannot enforce unordered friendship uniqueness: reverse-direction duplicates exist';
  end if;
end;
$$;

create unique index if not exists friendships_unique_unordered_pair
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  )
  where requester_id is not null and addressee_id is not null;

-- A deliberately non-diagnostic eligibility result: callers can learn only
-- whether they may send a request, not which private setting denied it.
create or replace function public.can_send_friend_request(p_addressee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and p_addressee_id is not null
    and auth.uid() <> p_addressee_id
    and exists (
      select 1 from public.profiles p where p.id = p_addressee_id
    )
    and coalesce((
      select ups.allow_friend_requests
      from public.user_privacy_settings ups
      where ups.user_id = p_addressee_id
    ), true)
    and coalesce((
      select ups.profile_visibility
      from public.user_privacy_settings ups
      where ups.user_id = p_addressee_id
    ), 'public') <> 'private'
    and not exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = p_addressee_id)
         or (b.blocker_id = p_addressee_id and b.blocked_id = auth.uid())
    )
    and not exists (
      select 1
      from public.friendships f
      where (f.requester_id = auth.uid() and f.addressee_id = p_addressee_id)
         or (f.requester_id = p_addressee_id and f.addressee_id = auth.uid())
    );
$$;

comment on function public.can_send_friend_request(uuid) is
  'Returns whether the caller may request the target: distinct existing profile, requests enabled, non-private, unblocked, and no relationship row in either direction.';

-- Send a pending request. The pair advisory lock serialises this operation
-- with another send, response, cancellation, or block for the same two users.
create or replace function public.send_friend_request(p_addressee_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_id uuid := auth.uid();
  v_friendship_id bigint;
begin
  if v_requester_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_addressee_id is null or p_addressee_id = v_requester_id then
    raise exception using errcode = '22023', message = 'Invalid friend request target';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(v_requester_id, p_addressee_id)::text || ':' ||
    greatest(v_requester_id, p_addressee_id)::text,
    0
  ));

  if not public.can_send_friend_request(p_addressee_id) then
    raise exception using
      errcode = '42501',
      message = 'Friend request is not permitted';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_requester_id, p_addressee_id, 'pending')
  returning id into v_friendship_id;

  return v_friendship_id;
end;
$$;

comment on function public.send_friend_request(uuid) is
  'Creates a pending friendship request after enforcing target privacy, bilateral blocks, pair uniqueness, and authenticated requester identity.';

-- Only the addressee can accept or decline a pending request. In particular,
-- the requester cannot manufacture reciprocal consent by updating their row.
create or replace function public.respond_to_friend_request(
  p_requester_id uuid,
  p_accept boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_addressee_id uuid := auth.uid();
  v_status text;
begin
  if v_addressee_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_requester_id is null or p_requester_id = v_addressee_id then
    raise exception using errcode = '22023', message = 'Invalid friend request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(v_addressee_id, p_requester_id)::text || ':' ||
    greatest(v_addressee_id, p_requester_id)::text,
    0
  ));

  if coalesce(p_accept, false) and exists (
    select 1
    from public.blocked_users b
    where (b.blocker_id = v_addressee_id and b.blocked_id = p_requester_id)
       or (b.blocker_id = p_requester_id and b.blocked_id = v_addressee_id)
  ) then
    raise exception using errcode = '42501', message = 'Friend request is not permitted';
  end if;

  update public.friendships f
  set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end,
      updated_at = now()
  where f.requester_id = p_requester_id
    and f.addressee_id = v_addressee_id
    and f.status = 'pending'
  returning f.status into v_status;

  if v_status is null then
    raise exception using
      errcode = '42501',
      message = 'No pending friend request can be resolved';
  end if;

  return v_status;
end;
$$;

comment on function public.respond_to_friend_request(uuid, boolean) is
  'Allows only the addressee to accept or decline a pending request; acceptance is denied while either user blocks the other.';

-- Requesters may cancel only their own still-pending request.
create or replace function public.cancel_friend_request(p_addressee_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_requester_id uuid := auth.uid();
  v_deleted_id bigint;
begin
  if v_requester_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_addressee_id is null or p_addressee_id = v_requester_id then
    raise exception using errcode = '22023', message = 'Invalid friend request target';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(v_requester_id, p_addressee_id)::text || ':' ||
    greatest(v_requester_id, p_addressee_id)::text,
    0
  ));

  delete from public.friendships f
  where f.requester_id = v_requester_id
    and f.addressee_id = p_addressee_id
    and f.status = 'pending'
  returning f.id into v_deleted_id;

  return v_deleted_id is not null;
end;
$$;

comment on function public.cancel_friend_request(uuid) is
  'Cancels only the calling requester''s pending request to the target.';

-- A block is authoritative over friendship state. This also prevents an
-- accepted friend from remaining visible in friend lists after either party
-- blocks the other. The same pair lock closes block/send and block/accept races.
create or replace function public.sever_friendship_on_block()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if new.blocker_id is null or new.blocked_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    least(new.blocker_id, new.blocked_id)::text || ':' ||
    greatest(new.blocker_id, new.blocked_id)::text,
    0
  ));

  delete from public.friendships f
  where (f.requester_id = new.blocker_id and f.addressee_id = new.blocked_id)
     or (f.requester_id = new.blocked_id and f.addressee_id = new.blocker_id);

  return new;
end;
$$;

drop trigger if exists sever_friendship_after_block on public.blocked_users;
create trigger sever_friendship_after_block
after insert or update on public.blocked_users
for each row execute function public.sever_friendship_on_block();

-- Remove the broad mutation policies and privileges. SECURITY DEFINER RPCs
-- above are now the sole authenticated mutation path; service_role retains its
-- owner/bypass access for administration and migrations.
drop policy if exists "Users can send friend requests" on public.friendships;
drop policy if exists "Users can update their friendships" on public.friendships;

revoke insert, update, delete, truncate on table public.friendships from anon, authenticated;

revoke all on function public.can_send_friend_request(uuid) from public, anon;
revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke all on function public.cancel_friend_request(uuid) from public, anon;
revoke all on function public.sever_friendship_on_block() from public, anon, authenticated;

grant execute on function public.can_send_friend_request(uuid) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
