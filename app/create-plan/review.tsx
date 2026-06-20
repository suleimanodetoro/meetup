// app/create-plan/review.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AppImage } from '~/components/AppImage';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import CreatePlanHeader from '~/components/CreatePlanHeader';
import { useCreatePlan } from '~/contexts/CreatePlanContext';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { decode } from 'base64-arraybuffer';

export default function ReviewScreen() {
  const { formData, resetForm, setStep } = useCreatePlan();
  const { session } = useAuth();
  const [creating, setCreating] = useState(false);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);

  useEffect(() => {
    if (formData.imageBase64) {
      setImagePreviewUri(`data:image/jpeg;base64,${formData.imageBase64}`);
    }
  }, [formData.imageBase64]);

  useFocusEffect(
    useCallback(() => {
      setStep(9);
    }, [setStep]),
  );

  const handleCreatePlan = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to create a plan');
      return;
    }

    setCreating(true);

    try {
      // Step 1: Upload image if exists
      let imageUrl = null;
      if (formData.imageBase64) {
        // Per-user folder so the owner-scoped storage policy matches ((foldername)[1] = uid).
        const fileName = `${session.user.id}/plan-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(formData.imageBase64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data: publicData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        imageUrl = publicData.publicUrl;
      }

      // Step 2: Create the event (with safe array access)
      const venues = formData.venues || [];
      const destinations = formData.destinations || [];
      const costs = formData.costs || [];
      const interests = formData.interests || [];
      
      const eventData = {
        title: formData.title,
        description: formData.description,
        user_id: session.user.id,
        date: formData.startDate.toISOString(),
        end_date: formData.endDate?.toISOString() || formData.startDate.toISOString(),
        interests: interests,
        city: venues[0]?.city || destinations[0]?.city || 'Unknown',
        location_name: venues[0]?.name || null,
        country: venues[0]?.country || destinations[0]?.country || 'Unknown',
        country_code: venues[0]?.country_code || destinations[0]?.country_code || 'XX',
        image_uri: imageUrl,
        is_private: false,
      };

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();

      if (eventError) {
        console.error('Event creation error:', eventError);
        throw new Error(`Failed to create event: ${eventError.message}`);
      }
      
      if (!event) {
        throw new Error('No event data returned from database');
      }

      // Step 3: Add venues
      if (venues.length > 0) {
        const venuesData = venues.map((venue, index) => ({
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

      // Step 4: Add costs
      if (costs.length > 0 && !costs.some(c => c.name === 'No expected cost')) {
        const costsData = costs
          .filter(c => c.name && c.name.trim())
          .map(cost => ({
            event_id: event.id,
            item_name: cost.name,
            amount: cost.amount || 0,
            is_optional: cost.isOptional || false,
            link_url: cost.link || null,
          }));
        if (costsData.length > 0) {
          await supabase.from('event_costs').insert(costsData);
        }
      }

      // Step 5: IMPORTANT - Add creator as attendee (this triggers conversation creation)
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          event_id: event.id,
          user_id: session.user.id,
        });

      if (attendanceError && attendanceError.code !== '23505') { // Ignore if already exists
        console.error('Failed to join event:', attendanceError);
      }

      // Step 6: Manually ensure conversation exists (in case trigger failed)
      // Check if conversation was created
      const { data: conversation, error: convCheckError } = await supabase
        .from('conversations')
        .select('id')
        .eq('event_id', event.id)
        .single();

      if (!conversation && !convCheckError) {
        // Create conversation manually if trigger didn't work
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            type: 'group',
            name: formData.title,
            event_id: event.id,
            avatar_url: imageUrl
          })
          .select()
          .single();

        if (!convError && newConv) {
          // Add creator as participant
          await supabase
            .from('conversation_participants')
            .insert({
              conversation_id: newConv.id,
              user_id: session.user.id,
            });
        }
      }

      // Step 7: Navigate WITHOUT resetting form immediately
      const eventId = event.id;

    // Pass fromCreation=true to show X button
    router.replace({
      pathname: '/event/[id]',
      params: { id: String(eventId), fromCreation: 'true' }
    });
    
    // Optional: Reset form after a delay to ensure navigation completes
    setTimeout(() => {
      resetForm();
    }, 500);

  } catch (error: any) {
    Alert.alert('Creation Failed', error?.message || 'An unexpected error occurred. Please try again.');
  } finally {
    setCreating(false);
  }
};

  const calculateTotalCost = () => {
    const costs = formData.costs || [];
    if (costs.length === 0 || costs.some(c => c.name === 'No expected cost')) {
      return 'Free';
    }
    
    const total = costs
      .filter(c => !c.isOptional && c.amount)
      .reduce((sum, c) => sum + (c.amount || 0), 0);
    
    const optionalCount = costs.filter(c => c.isOptional).length;
    
    if (total === 0 && optionalCount > 0) {
      return 'Optional costs only';
    }
    
    return `$${total.toFixed(2)}${optionalCount > 0 ? ' + optional' : ''}`;
  };

  const EditButton = ({ onPress }: { onPress: () => void }) => (
    <Pressable onPress={onPress} className="py-1 px-3">
      <Text className="text-sm font-medium text-indigo-600">Edit</Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <CreatePlanHeader />

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

            {imagePreviewUri && (
              <AppImage
                source={{ uri: imagePreviewUri }}
                style={{ marginTop: 12, height: 192, width: '100%', borderRadius: 12 }}
                contentFit="cover"
              />
            )}
          </View>

          {/* About */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                About
              </Text>
              <EditButton onPress={() => router.push('/create-plan/about')} />
            </View>
            <Text className="text-gray-700">{formData.description}</Text>
          </View>

          {/* Date */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Date
              </Text>
              <EditButton onPress={() => router.push('/create-plan/date')} />
            </View>
            <Text className="text-gray-700">
              {formData.startDate.toLocaleDateString()}
              {formData.endDate && formData.endDate !== formData.startDate
                ? ` - ${formData.endDate.toLocaleDateString()}`
                : ''}
            </Text>
          </View>

          {/* Destinations */}
          {formData.destinations && formData.destinations.length > 0 && (
            <View className="mt-4 rounded-2xl bg-gray-50 p-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Destinations
                </Text>
                <EditButton onPress={() => router.push('/create-plan/destinations')} />
              </View>
              {formData.destinations.map((dest, index) => (
                <Text key={index} className="text-gray-700">
                  • {dest.city}, {dest.country}
                </Text>
              ))}
            </View>
          )}

          {/* Venues */}
          {formData.venues && formData.venues.length > 0 && (
            <View className="mt-4 rounded-2xl bg-gray-50 p-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Venues
                </Text>
                <EditButton onPress={() => router.push('/create-plan/destinations')} />
              </View>
              {formData.venues.map((venue, index) => (
                <View key={index} className="mb-2">
                  <Text className="text-gray-900 font-medium">{venue.name}</Text>
                  {venue.address && <Text className="text-sm text-gray-600">{venue.address}</Text>}
                  {venue.city && <Text className="text-sm text-gray-600">{venue.city}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Interests */}
          {formData.interests && formData.interests.length > 0 && (
            <View className="mt-4 rounded-2xl bg-gray-50 p-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Interests
                </Text>
                <EditButton onPress={() => router.push('/create-plan/interests')} />
              </View>
              <View className="flex-row flex-wrap gap-2">
                {formData.interests.map((interest, index) => (
                  <View key={index} className="rounded-full bg-indigo-100 px-3 py-1">
                    <Text className="text-sm text-indigo-700">{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Costs */}
          <View className="mt-4 rounded-2xl bg-gray-50 p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Estimated Cost
              </Text>
              <EditButton onPress={() => router.push('/create-plan/costs')} />
            </View>
            <Text className="text-lg font-semibold text-gray-900">{calculateTotalCost()}</Text>

            {formData.costs && formData.costs.length > 0 && !formData.costs.some(c => c.name === 'No expected cost') && (
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
          {formData.guidelines && (
            <View className="mt-4 rounded-2xl bg-gray-50 p-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Guidelines
                </Text>
                <EditButton onPress={() => router.push('/create-plan/guidelines')} />
              </View>
              <Text className="text-gray-700">{formData.guidelines}</Text>
            </View>
          )}

          {/* Guidelines Accepted */}
          {formData.guidelinesAccepted && (
            <View className="mt-4 flex-row items-center gap-3 rounded-2xl bg-green-50 p-5">
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <Text className="text-[15px] text-green-700">Guidelines accepted</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Create Button */}
      <View className="border-t border-gray-200 bg-white px-5 pb-8 pt-4">
        <Pressable
          onPress={handleCreatePlan}
          disabled={creating}
          className={`items-center justify-center rounded-2xl py-4 ${creating ? 'bg-indigo-400' : 'bg-indigo-600'}`}
        >
          {creating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-center text-lg font-semibold text-white">Create Plan</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}