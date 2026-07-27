// utils/friendRequests.ts
// The client-side friendship state-transition API. The database RPCs are the
// actual enforcement boundary: app clients have no direct INSERT/UPDATE/DELETE
// privileges on friendships.
import { supabase } from '~/utils/supabase';

export async function canSendFriendRequest(addresseeId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_send_friend_request', {
    p_addressee_id: addresseeId,
  });
  if (error) throw error;
  return data === true;
}

export async function sendFriendRequest(addresseeId: string): Promise<number> {
  const { data, error } = await supabase.rpc('send_friend_request', {
    p_addressee_id: addresseeId,
  });
  if (error) throw error;
  return data;
}

export async function respondToFriendRequest(
  requesterId: string,
  accept: boolean
): Promise<'accepted' | 'declined'> {
  const { data, error } = await supabase.rpc('respond_to_friend_request', {
    p_requester_id: requesterId,
    p_accept: accept,
  });
  if (error) throw error;
  return data as 'accepted' | 'declined';
}

export async function cancelFriendRequest(addresseeId: string): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_friend_request', {
    p_addressee_id: addresseeId,
  });
  if (error) throw error;
  if (!data) throw new Error('No pending friend request could be cancelled');
}
