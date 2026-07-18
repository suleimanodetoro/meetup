// utils/friendRequests.ts
// The one friend-request write path. Both graduation-prompt moments
// (post-quest sheet, warm-pair profile card) and the profile screen's
// Add Friend button go through here — a request is always a plain
// 'pending' friendships insert that the other person must accept.
import { supabase } from '~/utils/supabase';

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  const { error } = await supabase.from('friendships').insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: 'pending',
  });
  if (error) throw error;
}
