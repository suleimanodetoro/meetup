// contexts/SubscriptionContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from './AuthProvider';

interface SubscriptionContextType {
  subscription: any | null;
  hasSubscription: boolean;
  isLoading: boolean;
  checkSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  hasSubscription: false,
  isLoading: true,
  checkSubscription: async () => {},
});

export function SubscriptionProvider({ children }) {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSubscription = async () => {
    if (!session?.user?.id) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [session]);

  return (
    <SubscriptionContext.Provider 
      value={{
        subscription,
        hasSubscription: !!subscription,
        isLoading,
        checkSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);