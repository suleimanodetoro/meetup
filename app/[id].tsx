import React from 'react';
import { Text, View, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';

import events from '~/assets/events.json';

export default function EventPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const event = events.find((e) => e.id === id);
  if (!event) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white justify-center items-center">
        <Text className="text-lg">Event not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      {/* hide the default header */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* respect the notch/statusbar */}
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        {/* full-bleed image with a custom back-button */}
        <View className="relative w-full aspect-video">
          <Image
            source={{ uri: event.image }}
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

        {/* only this block is padded */}
        <View className="flex-1 p-4 space-y-3">
          <Text className="text-3xl font-bold" numberOfLines={2}>
            {event.title}
          </Text>

          <Text className="text-lg font-semibold uppercase text-amber-800">
            {dayjs(event.datetime).format('ddd, D MMM')} ·{' '}
            {dayjs(event.datetime).format('h:mm A')}
          </Text>

          <Text className="text-lg" numberOfLines={3}>
            {event.description}
          </Text>
        </View>
      </SafeAreaView>
    </>
  );
}
