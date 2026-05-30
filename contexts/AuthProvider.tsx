// contexts/AuthProvider.tsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';
import { ActivityIndicator, View } from 'react-native';
import { identifyRevenueCatUser, signOutOfRevenueCat } from '~/lib/revenuecat';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  /**
   * Persisted onboarding cursor. NavigationController reads this on cold
   * start to send returning-but-not-yet-onboarded users to the step they
   * left off on, instead of always /onboarding/name.
   */
  onboardingStep: number;
  isLoading: boolean;
  refreshOnboardingStatus: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  onboardingStep: 0,
  isLoading: true,
  refreshOnboardingStatus: async () => {},
  signOut: async () => {},
});

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks whether we currently have an RC user identified, so that on
  // sign-out we only call Purchases.logOut() if we previously called
  // logIn(). Without this, the very first onAuthStateChange fire on cold
  // start (which arrives with session=null before any sign-in has
  // happened) would call signOutOfRevenueCat() against an anonymous RC
  // user and spam the console with "LogOut was called but the current
  // user is anonymous".
  const rcUserIdentifiedRef = useRef(false);

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
          setOnboardingStep(0);
          return false;
        }
        setHasCompletedOnboarding(false);
        setOnboardingStep(0);
        return false;
      }

      const isOnboarded = profile?.onboarding_completed === true;
      const persistedStep =
        typeof profile?.onboarding_step === 'number' ? profile.onboarding_step : 0;
      setHasCompletedOnboarding(isOnboarded);
      setOnboardingStep(persistedStep);
      return isOnboarded;

    } catch (err) {
      console.error('Error checking profile:', err);
      setHasCompletedOnboarding(false);
      setOnboardingStep(0);
      return false;
    }
  };

  // Manual refresh function for after profile updates
  const refreshOnboardingStatus = async () => {
    if (session?.user?.id) {
      await checkOnboardingStatus(session.user.id);
    }
  };

  // Sign out function. Clears RC explicitly here rather than relying on
  // the onAuthStateChange null-session branch — if supabase.auth.signOut()
  // throws after the local session has already been cleared, the listener
  // path can race and leave RC still identified as the previous user.
  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      if (rcUserIdentifiedRef.current) {
        void signOutOfRevenueCat();
        rcUserIdentifiedRef.current = false;
      }

      // Clear local state
      setSession(null);
      setHasCompletedOnboarding(false);
      setOnboardingStep(0);
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
        void identifyRevenueCatUser(session.user.id);
        rcUserIdentifiedRef.current = true;
        checkOnboardingStatus(session.user.id).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes. We mirror the Supabase user id into
    // RevenueCat so RC's customerInfo + webhook payloads carry our user
    // UUID rather than an anonymous device-scoped id.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (session?.user?.id) {
        void identifyRevenueCatUser(session.user.id);
        rcUserIdentifiedRef.current = true;
        // Gate isLoading=true while the profile fetch is in flight so
        // NavigationController doesn't mis-route on the stale default
        // hasCompletedOnboarding=false during a token refresh.
        setIsLoading(true);
        checkOnboardingStatus(session.user.id).finally(() => setIsLoading(false));
      } else {
        // Only tell RC to log out if we previously told it to log in.
        // The initial onAuthStateChange callback always fires with no
        // session before any real sign-in has happened — calling logOut
        // on RC there would throw "user is anonymous".
        if (rcUserIdentifiedRef.current) {
          void signOutOfRevenueCat();
          rcUserIdentifiedRef.current = false;
        }
        setHasCompletedOnboarding(false);
        setOnboardingStep(0);
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
        onboardingStep,
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