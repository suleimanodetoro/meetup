//app/event/[id]/_layout

import { Stack } from 'expo-router';

export default function EventIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}