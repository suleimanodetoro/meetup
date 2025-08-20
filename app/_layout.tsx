// app/_layout.tsx
import '../global.css';
import { Stack } from 'expo-router';
import AuthProvider, { useAuth } from './contexts/AuthProvider';
import { CreatePlanProvider } from './contexts/CreatePlanContext';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useRouter, useSegments, useRootNavigationState } from 'expo-router';

function NavigationController({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasCompletedOnboarding, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (isLoading) return;
    if (!rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const currentRoute = segments[0];

    // Add create-plan to allowed routes
    const allowedAuthenticatedRoutes = [
      'edit-profile',
      'add-trip',
      'settings',
      'event',
      'create-plan', // Add this
      'chat', // Add this for chat screens
      'visit'
    ];
    const isAllowedRoute = allowedAuthenticatedRoutes.includes(currentRoute);

    console.log('Navigation check:', {
      isAuthenticated,
      hasCompletedOnboarding,
      inAuthGroup,
      inTabsGroup,
      currentRoute,
      isAllowedRoute,
      segments,
    });

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        console.log('Redirecting to welcome (not authenticated)');
        router.replace('/welcome');
      }
    } else if (!hasCompletedOnboarding) {
      const isOnOnboardingScreen = segments[1]?.startsWith('onboarding');
      const isOnAuthScreen = segments[1] === 'welcome' || segments[1] === 'signin';

      if (!inAuthGroup || isOnAuthScreen) {
        console.log('Redirecting to onboarding (authenticated but not completed)');
        router.replace('/onboarding-basic');
      }
    } else {
      if (!inTabsGroup && !isAllowedRoute) {
        console.log('Redirecting to home (authenticated and onboarded)');
        router.replace('/(tabs)');
      }
    }
  }, [
    isAuthenticated,
    hasCompletedOnboarding,
    isLoading,
    segments,
    rootNavigationState?.key,
    router,
  ]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'white',
        }}>
        <ActivityIndicator size="large" color="#4A90E2" />
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
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="add-trip" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="event/[id]" />

            {/* Add all the new create-plan screens */}
            <Stack.Screen
              name="create-plan/name"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/image"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/about"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/date"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/destinations"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/interests"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/costs"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/guidelines"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="create-plan/review"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="visit/[id]"
              options={{
                headerShown: false,
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />

            {/* Add chat screen route */}
            <Stack.Screen
              name="chat/[id]"
              options={{
                headerShown: false,
                presentation: 'card',
              }}
            />
          </Stack>
        </NavigationController>
      </CreatePlanProvider>
    </AuthProvider>
        </GestureHandlerRootView>  

  );
}
