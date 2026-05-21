// app/_layout.tsx
import '../global.css';
import * as SplashScreen from 'expo-splash-screen';

import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import AuthProvider, { useAuth } from './contexts/AuthProvider';
import { CreatePlanProvider } from './contexts/CreatePlanContext';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';



function NavigationController({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasCompletedOnboarding, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for auth + navigation to be ready
    if (isLoading) return;
    if (!rootNavigationState?.key) return;

    const first = segments[0] ?? '';
    const inAuthGroup = first === '(auth)';
    const inTabsGroup = first === '(tabs)';

    // First visible segment (folder name) — used for allow-listing deep links
    const currentRoute = first;

    // Dynamic (parameterized) top-level folders
    const dynamicRoutes = ['event', 'chat', 'visit', 'profile'];

    // Static top-level folders/pages (include parents for nested pages)
    const staticRoutes = [
      'edit-profile',
      'add-trip',
      'settings',       // covers settings/privacy
      'create-plan',    // covers create-plan/* steps
      'search-users',
      'friend-requests',
      'explore',        // ADDED EXPLORE HERE!
    ];

    const isAllowedRoute =
      dynamicRoutes.includes(currentRoute) || staticRoutes.includes(currentRoute);

    // ----- Unauthenticated: keep them inside (auth) -----
    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/welcome'); // lives in (auth)
      return;
    }

    // ----- Authenticated but not onboarded: send to onboarding, even from (auth) -----
    if (!hasCompletedOnboarding) {
      const onOnboarding =
        inAuthGroup && segments[1] === 'onboarding';
      if (!onOnboarding) router.replace('/onboarding/basic'); // lives in (auth)/onboarding/[step]
      return;
    }

    // ----- Authenticated + onboarded -----
    // If we're still on any (auth) screen (e.g., /signin), leave immediately.
    if (inAuthGroup) {
      router.replace('/(tabs)');
      return;
    }

    // If not in tabs and not on an allowed deep link, send home.
    if (!inTabsGroup && !isAllowedRoute) {
      router.replace('/(tabs)');
    }
  }, [
    isAuthenticated,
    hasCompletedOnboarding,
    isLoading,
    segments,
    rootNavigationState?.key,
    router,
  ]);

  if (isLoading || !rootNavigationState?.key) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CreatePlanProvider>
          <NavigationController>
            <Stack screenOptions={{ headerShown: false }}>
              {/* App groups */}
              <Stack.Screen name="(tabs)" />

              {/* Dynamic deep-linkable routes */}
              <Stack.Screen name="event/[id]" />
              <Stack.Screen name="visit/[id]" />
              <Stack.Screen name="chat/[eventId]" />
              <Stack.Screen name="chat/dm/[conversationId]" />
              <Stack.Screen name="profile/[userId]" />

              {/* Common static routes */}
              <Stack.Screen name="edit-profile" />
              <Stack.Screen name="add-trip" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="settings/privacy" />
              <Stack.Screen name="search-users" />
              <Stack.Screen name="friend-requests" />
              <Stack.Screen name="explore" />

              {/* 404 */}
              <Stack.Screen name="+not-found" />
            </Stack>
          </NavigationController>
        </CreatePlanProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}