-- Phase 1 (deslop audit) — table-policy lockdown + write-scoping.
-- Closes BLOCKERS S1 (profiles) & S2 (visits), plus S5 (attendance INSERT),
-- S6 (events writes), and S7 (anon discovery reads).
--
-- Root cause across all of these: USING(true) SELECT policies granted TO public
-- + default anon table grants + a bundled anon key  =>  the shipped anon key can
-- read (and in places write) the whole DB. Fix: demote reads to `authenticated`,
-- scope writes to the owner via auth.uid(), and strip anon's table grants.
--
-- DELIBERATE: we do NOT revoke INSERT/UPDATE/DELETE from `authenticated` (the
-- audit's draft did — that breaks legitimate writes, because a row needs BOTH
-- the table GRANT and a passing RLS policy). authenticated keeps its DML grant;
-- the new owner-scoped policies are what actually constrain it.

-- ---------- S1 (BLOCKER): profiles — authenticated-only read ----------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "profiles_authenticated_read"
  ON public.profiles FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.profiles FROM anon;

-- ---------- S2 (BLOCKER): visits — authenticated-only read ----------
DROP POLICY IF EXISTS "Users can view all visits" ON public.visits;
CREATE POLICY "visits_authenticated_read"
  ON public.visits FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.visits FROM anon;

-- ---------- S5: attendance — auth-only read, owner-scoped insert ----------
DROP POLICY IF EXISTS "Enable read access for all users" ON public.attendance;
CREATE POLICY "attendance_authenticated_read"
  ON public.attendance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.attendance;
CREATE POLICY "attendance_self_insert"
  ON public.attendance FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE ALL ON public.attendance FROM anon;

-- ---------- S6/S7: events — auth-only read, owner-scoped writes ----------
DROP POLICY IF EXISTS "Enable read access for all users" ON public.events;
CREATE POLICY "events_authenticated_read"
  ON public.events FOR SELECT TO authenticated USING (true);

-- Drop every existing permissive write policy (INSERT/UPDATE/DELETE), whatever
-- its name, then add owner-scoped ones. (events ownership column is user_id.)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.events'::regclass AND polcmd IN ('a', 'w', 'd')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "events_owner_insert"
  ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_owner_update"
  ON public.events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_owner_delete"
  ON public.events FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.events FROM anon;
REVOKE TRUNCATE ON public.events FROM authenticated;

-- ---------- S7: event_costs / event_venues — authenticated-only read ----------
DROP POLICY IF EXISTS "Public can view event costs" ON public.event_costs;
CREATE POLICY "event_costs_authenticated_read"
  ON public.event_costs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Public can view event venues" ON public.event_venues;
CREATE POLICY "event_venues_authenticated_read"
  ON public.event_venues FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.event_costs, public.event_venues FROM anon;

-- ---------- S7: nearby_events RPC — authenticated only (returns raw venue coords) ----------
REVOKE EXECUTE ON FUNCTION public.nearby_events(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_events(double precision, double precision) TO authenticated;
