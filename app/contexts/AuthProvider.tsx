// app/contexts/AuthProvider.tsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';
import { ActivityIndicator, View } from 'react-native';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  refreshOnboardingStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  isLoading: true,
  refreshOnboardingStatus: async () => {},
});

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simple function to check onboarding - no callbacks, no deps
  const checkOnboardingStatus = async (userId: string) => {
    try {
      console.log('Checking onboarding status for:', userId);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      const isOnboarded = profile?.onboarding_completed === true;
      console.log('Profile onboarding status:', isOnboarded);
      setHasCompletedOnboarding(isOnboarded);
      return isOnboarded;
      
    } catch (err) {
      console.error('Error checking profile:', err);
      setHasCompletedOnboarding(false);
      return false;
    }
  };

  // Manual refresh function for after profile updates
  const refreshOnboardingStatus = async () => {
    if (session?.user?.id) {
      await checkOnboardingStatus(session.user.id);
    }
  };

  // Single useEffect that runs ONCE
  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      setSession(session);
      
      if (session?.user?.id) {
        checkOnboardingStatus(session.user.id).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.id);
      setSession(session);
      
      if (session?.user?.id) {
        checkOnboardingStatus(session.user.id);
      } else {
        setHasCompletedOnboarding(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty array - run ONCE

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAuthenticated: Boolean(session?.user),
        hasCompletedOnboarding,
        isLoading,
        refreshOnboardingStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);