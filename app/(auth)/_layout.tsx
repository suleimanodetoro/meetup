// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  // No logic here - just define the stack structure
  // All navigation logic is handled by the root NavigationController

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      {/* Authentication screens */}
      <Stack.Screen name="welcome" />
      <Stack.Screen name="signin" />
      {/* Onboarding flow screens in order */}
      <Stack.Screen name="onboarding-basic" />
      <Stack.Screen name="onboarding-nationality" />
      <Stack.Screen name="onboarding-gender" />
      <Stack.Screen name="onboarding-interests" />
      <Stack.Screen name="onboarding-pause" /> 
      <Stack.Screen name="onboarding-picture" />
      <Stack.Screen name="onboarding-languages" />
      <Stack.Screen name="onboarding-bio" />
      <Stack.Screen name="onboarding-preferences" />
      <Stack.Screen name="onboarding-gender-preference" />
      <Stack.Screen name="onboarding-trips" />
      <Stack.Screen name="onboarding-location" />
      <Stack.Screen name="onboarding-notifications" />
    </Stack>
  );
}
