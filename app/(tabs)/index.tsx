import { Stack } from 'expo-router';
import { FlatList, ActivityIndicator, Text, View } from 'react-native';
import EventListItem from '~/components/EventListItem';
import { supabase } from '~/utils/supabase';
import { useEffect, useState } from 'react';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  image_uri: string;
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('events').select('*');
      if (error) {
        setError(error.message);
      } else if (data) {
        setEvents(data);
      }
    } catch (err) {
      setError('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Events' }} />
        <View className="flex-1 bg-white justify-center items-center">
          <ActivityIndicator size="large" color="#ef4444" />
          <Text className="text-lg mt-4">Loading events...</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Events' }} />
        <View className="flex-1 bg-white justify-center items-center">
          <Text className="text-lg text-red-500 mb-4">Error: {error}</Text>
        </View>
      </>
    );
  }

  if (events.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Events' }} />
        <View className="flex-1 bg-white justify-center items-center">
          <Text className="text-lg text-gray-500">No events found</Text>
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