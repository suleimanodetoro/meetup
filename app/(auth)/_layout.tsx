
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
      <Stack.Screen name="welcome" />
      <Stack.Screen name="signin" />
      <Stack.Screen name="onboarding-basic" />
      <Stack.Screen name="onboarding-nationality" />
      <Stack.Screen name="onboarding-gender" />
    </Stack>
  );
}