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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  isLoading: true,
  refreshOnboardingStatus: async () => {},
  signOut: async () => {},
});

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Function to check onboarding status
  const checkOnboardingStatus = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              onboarding_completed: false,
              onboarding_step: 0,
            });
          
          if (insertError) {
            console.error('Error creating profile:', insertError);
          }
          setHasCompletedOnboarding(false);
          return false;
        }
        setHasCompletedOnboarding(false);
        return false;
      }

      const isOnboarded = profile?.onboarding_completed === true;
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

  // Sign out function
  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local state
      setSession(null);
      setHasCompletedOnboarding(false);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#007AFF" />
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
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);