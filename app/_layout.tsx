// app/_layout.tsx
import '../global.css';

import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import AuthProvider, { useAuth } from '~/contexts/AuthProvider';
import { CreatePlanProvider } from '~/contexts/CreatePlanContext';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureRevenueCat } from '~/lib/revenuecat';
import { waypointNotifications } from '~/modules/notifications';
// Slug-only import — dependency-free. Importing from ./sequence.ts here
// would pull react-native-date-picker through BirthdayField/TripsCustom
// into app boot and crash with a `nullthrows` at requireNativeComponent.
import { ONBOARDING_SLUGS } from '~/modules/onboarding/slugs';

// Configure the RC SDK once at module load. Idempotent; no-op when the
// platform's API key env var isn't set, so dev environments without an
// RC project don't crash the app.
configureRevenueCat();

function NotificationStartupEffect() {
  const { session, isAuthenticated, hasCompletedOnboarding, isLoading } = useAuth();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (isLoading || !isAuthenticated || !hasCompletedOnboarding || !userId) {
      return;
    }

    void waypointNotifications
      .sync({
        userId,
        reason: 'app-startup',
      })
      .catch((err) => {
        console.warn('Notification startup sync failed:', err);
      });
  }, [hasCompletedOnboarding, isAuthenticated, isLoading, userId]);

  return null;
}

function NavigationController({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasCompletedOnboarding, onboardingStep, isLoading } = useAuth();
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

    // Auth screens that *establish* the session via PKCE deep links and
    // must remain in control of the next navigation step. Without this
    // exception, the "kick out of (auth) when authenticated" rule below
    // fires the instant exchangeCodeForSession resolves and unmounts the
    // screen before it can show success or let the user pick a new
    // password.
    const innerAuthSegment = inAuthGroup ? segments[1] : undefined;
    const isTransientAuthFlow =
      innerAuthSegment === 'reset-password' || innerAuthSegment === 'confirm-email';

    // Dynamic (parameterized) top-level folders
    const dynamicRoutes = ['event', 'chat', 'city', 'profile'];

    // Static top-level folders/pages (include parents for nested pages)
    const staticRoutes = [
      'edit-profile',
      'add-trip',
      'settings', // covers settings/privacy
      'create-plan', // covers create-plan/* steps
      'search-users',
      'friend-requests',
      'explore',
      'search',
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
      const onOnboarding = inAuthGroup && segments[1] === 'onboarding';
      // Transient auth flows handle their own next-step navigation once
      // they've finished, so don't yank the user mid-exchange.
      if (!onOnboarding && !isTransientAuthFlow) {
        // Resume at the persisted step. commitStep writes onboarding_step on
        // every Continue, so returning users continue where they left off
        // instead of always landing back on /name. Clamp into the sequence
        // bounds defensively.
        const resumeIndex = Math.max(
          0,
          Math.min(onboardingStep, ONBOARDING_SLUGS.length - 1),
        );
        const resumeSlug = ONBOARDING_SLUGS[resumeIndex];
        router.replace(`/onboarding/${resumeSlug}`); // lives in (auth)/onboarding/[step]
      }
      return;
    }

    // ----- Authenticated + onboarded -----
    // If we're still on any (auth) screen (e.g., /signin), leave immediately —
    // except for transient flows that just established the session via a
    // deep link and need to remain visible to finish their work.
    if (inAuthGroup && !isTransientAuthFlow) {
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
    onboardingStep,
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
          <NotificationStartupEffect />
          <NavigationController>
            <Stack screenOptions={{ headerShown: false }}>
              {/* App groups */}
              <Stack.Screen name="(tabs)" />

              {/* Dynamic deep-linkable routes */}
              <Stack.Screen name="event/[id]" />
              <Stack.Screen name="city/[name]" />
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
              <Stack.Screen name="search" options={{ presentation: 'modal' }} />

              {/* 404 */}
              <Stack.Screen name="+not-found" />
            </Stack>
          </NavigationController>
        </CreatePlanProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
