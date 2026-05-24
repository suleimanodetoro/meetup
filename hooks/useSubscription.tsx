// hooks/useSubscription.tsx
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';

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

  // Source-of-truth derivation. Callers must not add ad-hoc gates on
  // subscription_type or is_active — both are gone or redundant now.
  const hasSubscription =
    subscription !== null &&
    subscription.entitlement_id !== null &&
    (subscription.expires_at === null || new Date(subscription.expires_at) > new Date());

  return {
    subscription,
    hasSubscription,
    isLoading,
    refetch: fetchSubscription,
  };
}
