import { Stack } from 'expo-router';
import { FlatList, ActivityIndicator, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import EventListItem from '~/components/EventListItem';
import { supabase } from '~/utils/supabase';
import { NearbyEvent } from '~/types/db';

export default function Home() {
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNearbyEvents();
  }, []);
  
    // 🔧 Currently unused — fetches all events without filtering
  // const fetchAllEvents = async () => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const { data, error } = await supabase.from('events').select('*');
  //     if (error) {
  //       setError(error.message);
  //     } else if (data) {
  //       setEvents(data);
  //     }
  //   } catch (err) {
  //     setError('Failed to fetch events');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const fetchNearbyEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('nearby_events', {
        lat: 9.0145526,
        long: 7.5589706,
      });

      if (error) {
        console.error('RPC Error:', error);
        setError(error.message);
        setEvents([]);
      } else {
        setEvents(data || []);
      }
    } catch (err) {
      console.error('Unexpected Error:', err);
      setError('Failed to fetch nearby events');
      setEvents([]);
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
        <View className="flex-1 bg-white justify-center items-center px-4">
          <Text className="text-lg text-red-500 mb-4 text-center">Error: {error}</Text>
        </View>
      </>
    );
  }

  if (events.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Events' }} />
        <View className="flex-1 bg-white justify-center items-center">
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
