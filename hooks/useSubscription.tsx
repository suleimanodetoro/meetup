// hooks/useSubscription.ts
import { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';

interface Subscription {
  id: number;
  user_id: string;
  subscription_type: 'free' | 'premium' | 'pro';
  started_at: string;
  expires_at?: string;
  is_active: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

export function useSubscription() {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSubscription = async () => {
    if (!session?.user?.id) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        console.error('Error checking subscription:', error);
      }

      setSubscription((data ?? null) as unknown as Subscription | null);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();
    
    // Subscribe to subscription changes
    const subscription = supabase
      .channel('subscription_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${session?.user?.id}`,
        },
        () => {
          checkSubscription();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [session]);

  return {
    subscription,
    hasSubscription: !!subscription && subscription.subscription_type !== 'free',
    isPremium: subscription?.subscription_type === 'premium',
    isPro: subscription?.subscription_type === 'pro',
    isLoading,
    refetch: checkSubscription,
  };
}