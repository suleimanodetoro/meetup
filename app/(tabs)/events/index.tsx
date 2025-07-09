import { Stack } from 'expo-router';
import { FlatList, Text, View, ActivityIndicator } from 'react-native';
import EventListItem from '~/components/EventListItem';
import { useNearbyEvents } from '~/hooks/useNearbyEvents';

export default function Home() {
  const { events, loading, error } = useNearbyEvents();

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Events' }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#ef4444" />
          <Text className="mt-4 text-lg">Loading events...</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Events' }} />
        <View className="flex-1 items-center justify-center bg-white px-4">
          <Text className="mb-4 text-center text-lg text-red-500">Error: {error}</Text>
        </View>
      </>
    );
  }

  if (events.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Events' }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-lg text-gray-500">No events found nearby</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Events' }} />
      <FlatList
        data={events}
        className="bg-white"
        renderItem={({ item }) => <EventListItem event={item} />}
        keyExtractor={(item) => item.id?.toString()}
      />
    </>
  );
}