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
import { useLocalSearchParams, Stack, Link, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';
import { Attendance, Event } from '~/types/db';

import SupaImage from '~/components/SupaImage';

export default function EventPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (id) fetchEvent();
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
      setEvent(eventData);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user?.id)
        .eq('event_id', id)
        .single();
      if (!attendanceError) setAttendance(attendanceData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch event');
    } finally {
      setLoading(false);
    }
  };

  const joinEvent = async () => {
    if (!event) return;
    const { data, error } = await supabase
      .from('attendance')
      .insert({ user_id: user?.id, event_id: event.id })
      .select()
      .single();
    if (!error) setAttendance(data);
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#ef4444" />
        <Text className="mt-4 text-lg">Loading event...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white items-center justify-center p-4">
        <Text className="text-lg text-red-500">Error: {error}</Text>
        <Pressable onPress={fetchEvent} className="mt-4 rounded bg-red-500 px-4 py-2">
          <Text className="text-white">Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white items-center justify-center">
        <Text className="text-lg text-gray-500">Event not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      {/* Hide the default header */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        {/* Hero image + back button */}
        <View className="relative aspect-video w-full">
          <SupaImage
            path={event.image_uri}
            className="h-full w-full"
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 top-4 rounded-full bg-white bg-opacity-60 p-2"
          >
            <Text className="text-lg text-black">←</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View className="flex-1 space-y-3 p-4">
          <Text className="text-3xl font-bold" numberOfLines={2}>
            {event.title}
          </Text>

          <Text className="text-lg font-semibold uppercase text-amber-800">
            {dayjs(event.date).format('ddd, D MMM')} · {dayjs(event.date).format('h:mm A')}
          </Text>
          <Text className='text-lg font-bold'>📍{event.location}</Text>

          <Text className="text-lg text-gray-700" numberOfLines={3}>
            {event.description}
          </Text>

          <Link
            href={`/event/${event.id}/attendance`}
            className="text-lg text-amber-800"
            numberOfLines={1}
          >
            View Attendance
          </Link>
        </View>

        {/* Footer (not absolute!) */}
        <View className="flex-row items-center justify-between border-t-2 border-gray-300 p-5">
          <Text className="text-xl font-semibold">Free</Text>
          {attendance ? (
            <View className="rounded-md bg-green-100 px-4 py-2">
              <Text className="text-lg text-green-700 font-semibold">
                You’re attending 😊❗️
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={joinEvent}
              className="rounded-md bg-red-500 p-4 px-6"
            >
              <Text className="text-lg font-bold text-white">Join and RSVP</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}
