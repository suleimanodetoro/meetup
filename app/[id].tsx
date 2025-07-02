import React, { useEffect, useState } from 'react';
import { Text, View, Image, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '~/utils/supabase';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  image_uri: string;
}

export default function EventPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        setError(error.message);
      } else {
        setEvent(data);
      }
    } catch (err) {
      setError('Failed to fetch event');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#ef4444" />
        <Text className="text-lg mt-4">Loading event...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white justify-center items-center">
        <Text className="text-lg text-red-500">Error: {error}</Text>
        <TouchableOpacity onPress={fetchEvent} className="mt-4 bg-red-500 px-4 py-2 rounded">
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white justify-center items-center">
        <Text className="text-lg">Event not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        <View className="relative w-full aspect-video">
          <Image
            source={{ uri: event.image_uri }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-4 left-4 bg-white bg-opacity-60 p-2 rounded-full"
          >
            <Text className="text-black text-lg">←</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-1 p-4 space-y-3">
          <Text className="text-3xl font-bold" numberOfLines={2}>
            {event.title}
          </Text>

          <Text className="text-lg font-semibold uppercase text-amber-800">
            {dayjs(event.date).format('ddd, D MMM')} ·{' '}
            {dayjs(event.date).format('h:mm A')}
          </Text>

          <Text className="text-lg" numberOfLines={3}>
            {event.description}
          </Text>
        </View>

        {/* Footer - using flex positioning instead of absolute */}
        <View className="flex-row items-center justify-between border-t-2 border-gray-300 p-5 pb-10">
          <Text className="text-xl font-semibold">Free</Text>
          <Pressable className="rounded-md bg-red-500 p-5 px-8">
            <Text className="text-lg font-bold text-white">Join and RSVP</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}