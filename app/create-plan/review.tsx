// app/create-plan/review.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '../contexts/CreatePlanContext';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { decode } from 'base64-arraybuffer';

// keep your helper
const extractBase64 = (s: string) => {
  if (!s) return '';
  if (s.startsWith('data:')) {
    const i = s.indexOf(',');
    return i >= 0 ? s.slice(i + 1) : s;
  }
  return s;
};

export default function ReviewScreen() {
  const { formData, resetForm } = useCreatePlan();
  const { session } = useAuth();
  const [creating, setCreating] = useState(false);

  const formatDate = (date?: Date) =>
    date
      ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'Not set';

  const formatTime = (date?: Date) =>
    date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Not set';

  const calculateTotalCost = () => {
    if (formData.costs.some(c => c.name === 'No expected cost')) return 'Free';
    const total = formData.costs
      .filter(c => c.amount && !c.isOptional)
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    return total === 0 ? 'Free' : `$${total.toFixed(2)}`;
  };

  // show the actual image
  const imagePreviewUri = useMemo(() => {
    if (formData?.imageUri) return formData.imageUri;
    if (formData?.imageBase64) return `data:image/jpeg;base64,${formData.imageBase64}`;
    return undefined;
  }, [formData?.imageUri, formData?.imageBase64]);

  const handleCreatePlan = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to create a plan');
      return;
    }

    setCreating(true);
    try {
      // Step 1: upload image (if any)
      let imageUrl: string | null = null;

      if (formData.imageBase64) {
        const fileExt = 'jpg';
        const fileName = `event-${session.user.id}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${fileExt}`;

        const rawB64 = extractBase64(formData.imageBase64).replace(/\s/g, '');

        let bytes: Uint8Array;
        try {
          const raw = decode(rawB64); // ArrayBuffer
          bytes = new Uint8Array(raw); // RN-safe ArrayBufferView
        } catch (e) {
          throw new Error('Could not decode image data.');
        }

        if (bytes.byteLength > 9 * 1024 * 1024) {
          throw new Error('Image too large. Please pick a smaller image (< 9MB).');
        }

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, bytes, {
            contentType: 'image/jpeg',
            upsert: false,
            cacheControl: '3600',
          });

        if (uploadError) throw new Error(uploadError.message || 'Image upload failed.');

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        imageUrl = publicUrl ?? null;
      }

      // Step 2: build & insert event
      const eventData = {
        title: formData.title,
        description: formData.description,
        date: formData.startDate.toISOString(),
        end_date: formData.isOneDay ? null : formData.endDate?.toISOString(),
        image_uri: imageUrl,
        user_id: session.user.id,
        interests: formData.interests,
        is_one_day: formData.isOneDay,
        is_all_day: formData.isAllDay,
        guidelines_accepted: formData.guidelinesAccepted,
        guidelines_accepted_at: new Date().toISOString(),
        city: formData.venues[0]?.city || null,
        location_name: formData.venues[0]?.name || null,
        country: formData.venues[0]?.country || null,
        country_code: formData.venues[0]?.country_code || null,
        location_point:
          formData.venues[0]?.lat && formData.venues[0]?.lng
            ? `POINT(${formData.venues[0].lng} ${formData.venues[0].lat})`
            : null,
      };

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();

      if (eventError) throw new Error(`Failed to create event: ${eventError.message}`);
      if (!event) throw new Error('No event data returned from database');

      // Step 3: add venues
      if (formData.venues.length > 0) {
        const venuesData = formData.venues.map((venue, index) => ({
          event_id: event.id,
          venue_name: venue.name,
          venue_address: venue.address,
          venue_city: venue.city,
          venue_country: venue.country,
          venue_country_code: venue.country_code,
          venue_lat: venue.lat,
          venue_lng: venue.lng,
          order_index: index,
        }));
        await supabase.from('event_venues').insert(venuesData);
      }

      // Step 4: add costs
      if (formData.costs.length > 0 && !formData.costs.some(c => c.name === 'No expected cost')) {
        const costsData = formData.costs
          .filter(c => c.name.trim())
          .map(cost => ({
            event_id: event.id,
            item_name: cost.name,
            amount: cost.amount,
            is_optional: cost.isOptional,
            link_url: cost.link,
          }));
        await supabase.from('event_costs').insert(costsData);
      }

      // success: reset + send to start of stack (tabs root)
      resetForm();
      router.replace('/(tabs)');

    } catch (error: any) {
      Alert.alert('Creation Failed', error?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const EditButton = ({ onPress }: { onPress: () => void }) => (
    <Pressable onPress={onPress} className="py-1 px-3">
      <Text className="text-sm font-medium text-indigo-600">Edit</Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-5 py-4">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-semibold">Create Plan</Text>
        <View className="w-8" />
      </View>

      {/* Progress */}
      <StepperProgress currentStep={9} totalSteps={9} />

      <ScrollView className="flex-1">
        <View className="px-6 pt-8 pb-6">
          <Text className="text-3xl font-bold">Review</Text>
          <Text className="mt-1 text-base text-gray-600">Check everything looks good</Text>

          {/* Name & Image */}
          <View className="mt-6 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Name & Image
              </Text>
              <EditButton onPress={() => router.push('/create-plan/name')} />
            </View>

            <Text className="text-lg font-semibold text-gray-900">{formData.title}</Text>

            {imagePreviewUri ? (
              <View className="mt-3 overflow-hidden rounded-xl bg-gray-100">
                <Image source={{ uri: imagePreviewUri }} className="h-44 w-full" resizeMode="cover" />
              </View>
            ) : (
              <View className="mt-3 flex-row items-center gap-2">
                <Ionicons name="image" size={16} color="#4A90E2" />
                <Text className="text-sm text-indigo-500">No image</Text>
              </View>
            )}
          </View>

          {/* About */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">About</Text>
              <EditButton onPress={() => router.push('/create-plan/about')} />
            </View>
            <Text className="text-[15px] leading-6 text-gray-900">{formData.description}</Text>
          </View>

          {/* Date */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">Date</Text>
              <EditButton onPress={() => router.push('/create-plan/date')} />
            </View>
            <Text className="text-lg font-semibold text-gray-900">
              {formData.isOneDay
                ? formatDate(formData.startDate)
                : `${formatDate(formData.startDate)} - ${formatDate(formData.endDate)}`}
            </Text>
            {!formData.isAllDay && (
              <Text className="mt-1 text-sm text-gray-600">
                {formatTime(formData.startDate)}
                {!formData.isOneDay && formData.endDate ? ` - ${formatTime(formData.endDate)}` : ''}
              </Text>
            )}
            <View className="mt-2 flex-row gap-2">
              {formData.isOneDay && (
                <View className="rounded-full bg-indigo-50 px-3 py-1">
                  <Text className="text-xs font-semibold text-indigo-600">One-day</Text>
                </View>
              )}
              {formData.isAllDay && (
                <View className="rounded-full bg-indigo-50 px-3 py-1">
                  <Text className="text-xs font-semibold text-indigo-600">All-day</Text>
                </View>
              )}
            </View>
          </View>

          {/* Destinations */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Destinations ({formData.venues.length})
              </Text>
              <EditButton onPress={() => router.push('/create-plan/destinations')} />
            </View>
            {formData.venues.map((venue, index) => (
              <View key={index} className="mb-2">
                <Text className="text-[15px] text-gray-900">• {venue.name}</Text>
                {venue.city ? <Text className="text-sm text-gray-600">{venue.city}</Text> : null}
              </View>
            ))}
          </View>

          {/* Interests */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Interests ({formData.interests.length})
              </Text>
              <EditButton onPress={() => router.push('/create-plan/interests')} />
            </View>
            <View className="flex-row flex-wrap gap-2">
              {formData.interests.map(interest => (
                <View key={interest} className="rounded-full bg-white px-3 py-1">
                  <Text className="text-sm text-gray-800">{interest}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Costs */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Estimated Cost
              </Text>
              <EditButton onPress={() => router.push('/create-plan/costs')} />
            </View>
            <Text className="text-lg font-semibold text-gray-900">{calculateTotalCost()}</Text>

            {formData.costs.length > 0 && !formData.costs.some(c => c.name === 'No expected cost') && (
              <View className="mt-3 border-t border-gray-200 pt-3">
                {formData.costs.map((cost, index) => (
                  <View key={index} className="mb-2 flex-row items-baseline justify-between">
                    <Text className="text-[15px] text-gray-900">
                      {cost.name}
                      {cost.isOptional ? ' (optional)' : ''}
                    </Text>
                    {typeof cost.amount === 'number' && (
                      <Text className="text-sm font-medium text-gray-700">${cost.amount.toFixed(2)}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Guidelines */}
          <View className="mt-4 flex-row items-center gap-3 rounded-2xl bg-green-50 p-5">
            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
            <Text className="text-[15px] text-green-700">Guidelines accepted</Text>
          </View>
        </View>
      </ScrollView>

      {/* Create Button */}
      <View className="border-t border-gray-200 bg-white px-5 pb-8">
        <Pressable
          onPress={handleCreatePlan}
          disabled={creating}
          className={`items-center justify-center rounded-2xl py-4 ${creating ? 'bg-indigo-400' : 'bg-indigo-600'}`}
        >
          {creating ? (
            <View className="flex-row items-center">
              <ActivityIndicator />
              <Text className="ml-2 font-semibold text-white">Creating…</Text>
            </View>
          ) : (
            <Text className="font-semibold text-white">Create Plan</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
