// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  // No logic here - just define the stack structure. All navigation logic
  // is handled by the root NavigationController. The onboarding flow is a
  // single dynamic route mounted at /onboarding/[step]; the sequence lives
  // in modules/onboarding/sequence.ts.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="signin" />
      <Stack.Screen name="onboarding/[step]" />
    </Stack>
  );
}
