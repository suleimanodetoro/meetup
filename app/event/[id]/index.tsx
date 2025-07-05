import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  Image,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';

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
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { user } = useAuth();

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user?.id)
        .eq('event_id', id)
        .single();

      setEvent(eventData);
      if (!attendanceError) {
        setAttendance(attendanceData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch event');
    } finally {
      setLoading(false);
    }
  };

  const joinEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          user_id: user?.id,
          event_id: event?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setAttendance(data);
    } catch (err) {
      console.error('Join event failed:', err);
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#ef4444" />
        <Text className="mt-4 text-lg">Loading event...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-red-500">Error: {error}</Text>
        <TouchableOpacity onPress={fetchEvent} className="mt-4 rounded bg-red-500 px-4 py-2">
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg">Event not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        <View className="relative aspect-video w-full">
          <Image source={{ uri: event.image_uri }} className="h-full w-full" resizeMode="cover" />
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 top-4 rounded-full bg-white bg-opacity-60 p-2">
            <Text className="text-lg text-black">←</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-1 space-y-3 p-4">
          <Text className="text-3xl font-bold" numberOfLines={2}>
            {event.title}
          </Text>

          <Text className="text-lg font-semibold uppercase text-amber-800">
            {dayjs(event.date).format('ddd, D MMM')} · {dayjs(event.date).format('h:mm A')}
          </Text>

          <Text className="text-lg" numberOfLines={3}>
            {event.description}
          </Text>
          <Link href={`/event/${event.id}/attendance`} className="text-lg" numberOfLines={3}>
            View Attendance
          </Link>
        </View>

        {/* Footer */}
        <View className="flex-row items-center justify-between border-t-2 border-gray-300 p-5 pb-10">
          <Text className="text-xl font-semibold">Free</Text>
          {attendance ? (
            <View className="rounded-md bg-green-100 px-4 py-2">
              <Text className="text-lg text-green-700 font-semibold">You’re attending 😊❗️</Text>
            </View>
          ) : (
            <Pressable className="rounded-md bg-red-500 p-5 px-8" onPress={joinEvent}>
              <Text className="text-lg font-bold text-white">Join and RSVP</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}
