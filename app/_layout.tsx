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
    
    // More comprehensive route checking
    const dynamicRoutes = ['event', 'chat', 'visit', 'profile'];
    const staticRoutes = ['edit-profile', 'add-trip', 'settings', 'create-plan'];
    
    // Check if it's a dynamic route (with parameters)
    const isDynamicRoute = dynamicRoutes.includes(currentRoute);
    const isStaticRoute = staticRoutes.includes(currentRoute);
    const isAllowedRoute = isDynamicRoute || isStaticRoute;

    console.log('Navigation check:', {
      isAuthenticated,
      hasCompletedOnboarding,
      inAuthGroup,
      inTabsGroup,
      currentRoute,
      isAllowedRoute,
      isDynamicRoute,
      segments,
    });

    // Navigation logic with better error handling
    try {
      if (!isAuthenticated) {
        if (!inAuthGroup) {
          console.log('Redirecting to welcome (not authenticated)');
          router.replace('/welcome');
        }
      } else if (!hasCompletedOnboarding) {
        const isOnOnboardingScreen = segments[0] === '(auth)' && segments[1]?.startsWith('onboarding');
        
        if (!isOnOnboardingScreen && !inAuthGroup) {
          console.log('Redirecting to onboarding (authenticated but not completed)');
          router.replace('/onboarding-basic');
        }
      } else {
        // User is authenticated and onboarded
        // Only redirect if they're truly on an invalid route
        if (!inTabsGroup && !isAllowedRoute && !inAuthGroup) {
          console.log('Redirecting to home - invalid route');
          router.replace('/(tabs)');
        }
        // If we're on a valid route, do nothing - let the screen handle any errors
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Don't redirect on error - let the screen handle it
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
      <View style={{
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
              
              {/* Folder-based route for event */}
              <Stack.Screen name="event/[id]" options={{ headerShown: false }} />

              {/* create-plan screens */}
              <Stack.Screen
                name="create-plan/name"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/image"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/about"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/date"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/destinations"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/interests"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/costs"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/guidelines"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="create-plan/review"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />

              {/* visit route */}
              <Stack.Screen
                name="visit/[id]"
                options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
              />

              {/* chat screens */}
              <Stack.Screen
                name="chat/[eventId]"
                options={{ headerShown: false, presentation: 'card' }}
              />
              <Stack.Screen name="chat/dm/[conversationId]" options={{ headerShown: false }} />
              <Stack.Screen name="profile/[userId]" options={{ headerShown: false }} />
            </Stack>
          </NavigationController>
        </CreatePlanProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}