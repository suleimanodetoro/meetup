// app/_layout.tsx
import '../global.css';
import { Stack } from 'expo-router';
import AuthProvider, { useAuth } from './contexts/AuthProvider';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';

function NavigationController({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasCompletedOnboarding, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading) return; // Don't do anything while loading
    if (!rootNavigationState?.key) return; // Wait for navigation to be ready

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const currentRoute = segments[0]; // Get the first segment
    const currentSubRoute = segments[1]; // Get the specific route within the group
    
    // Define allowed root-level routes for authenticated users
    const allowedAuthenticatedRoutes = ['edit-profile', 'add-trip', 'settings', 'event'];
    const isAllowedRoute = allowedAuthenticatedRoutes.includes(currentRoute);

    console.log('Navigation check:', {
      isAuthenticated,
      hasCompletedOnboarding,
      inAuthGroup,
      inTabsGroup,
      currentRoute,
      currentSubRoute,
      isAllowedRoute,
      segments
    });

    // Determine where user should be
    if (!isAuthenticated) {
      // User is not signed in - should be in auth group
      if (!inAuthGroup) {
        console.log('Redirecting to welcome (not authenticated)');
        router.replace('/welcome');
      }
      // If they're in auth group, let them stay on welcome, signin, or early onboarding screens
    } else if (!hasCompletedOnboarding) {
      // User is signed in but hasn't completed onboarding
      // They should be in auth group but on onboarding screens
      const isOnOnboardingScreen = currentSubRoute?.startsWith('onboarding');
      const isOnAuthScreen = currentSubRoute === 'welcome' || currentSubRoute === 'signin';
      
      if (!inAuthGroup || isOnAuthScreen) {
        console.log('Redirecting to onboarding (authenticated but not completed)');
        router.replace('/onboarding-basic');
      }
      // If they're already on an onboarding screen, let them continue
    } else {
      // User is signed in and has completed onboarding
      // Only redirect if not in tabs AND not on an allowed route
      if (!inTabsGroup && !isAllowedRoute) {
        console.log('Redirecting to home (authenticated and onboarded)');
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, hasCompletedOnboarding, isLoading, segments, rootNavigationState?.key, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationController>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="add-trip" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="event/[id]" />
        </Stack>
      </NavigationController>
    </AuthProvider>
  );
}