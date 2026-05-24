// hooks/useSubscription.tsx
import { useCallback, useEffect, useState } from 'react';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { isRevenueCatConfigured } from '~/lib/revenuecat';

const ENTITLEMENT_ID = 'premium';

interface SubscriptionRow {
  id: number;
  user_id: string;
  subscription_type: 'free' | 'premium';
  entitlement_id: string | null;
  original_transaction_id: string | null;
  provider: 'app_store' | 'play_store' | 'stripe' | 'promotional' | null;
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mirror of RevenueCat subscription state for the current user.
 *
 * RC is the canonical source of truth: a Supabase Edge Function webhook
 * writes into public.user_subscriptions whenever the user's status changes
 * (purchase, renewal, cancellation, expiration). This hook just reads that
 * table and subscribes to postgres_changes so the UI updates in real time.
 *
 * `hasSubscription` is the only flag callers should branch on. It's true
 * when the user has an active entitlement that hasn't expired. The
 * derivation lives here (not in the table) so an expired row can't grant
 * access even if the webhook hasn't fired yet.
 */
export function useSubscription() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // RC's own view of the user's entitlement, held alongside the DB row.
  // RC's local customerInfo updates the instant a purchase succeeds, well
  // before the webhook + realtime chain delivers a fresh row from Supabase
  // (which can be 3–10 seconds). Without this, the UI stays locked for that
  // entire window even though the user just paid.
  const [rcEntitled, setRcEntitled] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
      } else {
        setSubscription((data ?? null) as unknown as SubscriptionRow | null);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchSubscription();
    if (!userId) return;

    // Per-user channel so multiple hook instances and multiple users don't
    // collide on one hardcoded channel name.
    const channel = supabase
      .channel(`subscription_changes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${userId}`,
        },
        () => void fetchSubscription(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, fetchSubscription]);

  // Hook RC's customerInfo so the moment a purchase clears (or a restore
  // succeeds, or the app foregrounds and RC re-syncs), we flip rcEntitled
  // immediately. Also opportunistically re-fetches the DB row — by the time
  // we get here the webhook may already have landed.
  useEffect(() => {
    if (!isRevenueCatConfigured()) return;
    // Seed from current customerInfo without waiting for an event.
    Purchases.getCustomerInfo()
      .then((info) => setRcEntitled(!!info.entitlements.active[ENTITLEMENT_ID]))
      .catch(() => {
        /* fail open — DB row will still gate access */
      });

    const listener = (info: CustomerInfo) => {
      const entitled = !!info.entitlements.active[ENTITLEMENT_ID];
      setRcEntitled(entitled);
      // If RC just turned us on, the webhook is in flight — grab the row
      // when it lands.
      if (entitled) void fetchSubscription();
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [fetchSubscription]);

  // Either source confirming the entitlement is enough. RC's local state is
  // fast, the DB row is authoritative long-term. Both sources falling silent
  // (RC says inactive, DB row is null/expired) means no access.
  const dbEntitled =
    subscription !== null &&
    subscription.entitlement_id !== null &&
    (subscription.expires_at === null || new Date(subscription.expires_at) > new Date());
  const hasSubscription = rcEntitled || dbEntitled;

  return {
    subscription,
    hasSubscription,
    isLoading,
    refetch: fetchSubscription,
  };
}
