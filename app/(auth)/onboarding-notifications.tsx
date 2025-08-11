// app/(auth)/onboarding-notifications.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';

export default function OnboardingNotificationsScreen() {
  const params = useLocalSearchParams();
  const { session, refreshOnboardingStatus } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleEnableNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    await saveProfileAndComplete(status === 'granted');
  };

  const handleSkip = async () => {
    await saveProfileAndComplete(false);
  };

  const saveProfileAndComplete = async (notificationsEnabled: boolean) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'User session not found');
      return;
    }

    setLoading(true);
    try {
      // Parse all the data from params
      const interests = params.interests ? JSON.parse(params.interests as string) : [];
      const languages = params.languages ? JSON.parse(params.languages as string) : ['en'];
      
      // Format birth date properly
      const birthDate = new Date(params.birthDate as string);
      const formattedBirthDate = birthDate.toISOString().split('T')[0];

      // Update the user's profile with ALL collected data
      const profileData = {
        full_name: params.name as string,
        birth_date: formattedBirthDate,
        gender: params.gender as string,
        nationality: params.nationalityName as string,
        nationality_code: params.nationality as string,
        interests: interests,
        languages: languages,
        bio: params.bio as string || null,
        avatar_url: params.avatar_url as string || null,
        meeting_preference: params.meet_preference as string || null,
        gender_preference: params.gender_preference as string || null,
        onboarding_completed: true,
        onboarding_step: 13, // Final step
        updated_at: new Date().toISOString(),
        // Note: Consider adding a username selection screen
        // For now, we'll skip username to avoid conflicts
        // username: (params.name as string).toLowerCase().replace(/\s+/g, ''),
      };

      console.log('Saving complete profile:', profileData);

      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', session.user.id);

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      // If user added a trip, it should already be saved in onboarding-trips
      // No need to save it again here

      console.log('Profile saved successfully');
      
      // Refresh the onboarding status in AuthProvider
      await refreshOnboardingStatus();
      
      // The NavigationController will automatically redirect to tabs
      // once it detects the onboarding is complete
      
    } catch (error: any) {
      console.error('Complete profile error:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 10,
        }}>
          <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
            <Text style={{ fontSize: 30 }}>←</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 30, justifyContent: 'center' }}>
          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Text style={{ fontSize: 80 }}>🔔</Text>
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 36,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center',
          }}>
            enable notifications
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 40,
            textAlign: 'center',
          }}>
            get notified when other travelers message you
          </Text>

          {/* Feature Cards */}
          <View style={{ gap: 16, marginBottom: 40 }}>
            <View style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
            }}>
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 12,
                backgroundColor: '#E3F2FD',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 24 }}>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 4,
                }}>
                  Messages
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#666',
                }}>
                  Receive messages from other travelers
                </Text>
              </View>
            </View>

            <View style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
            }}>
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 12,
                backgroundColor: '#E3F2FD',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 24 }}>🚨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 4,
                }}>
                  Nearby Alerts
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#666',
                }}>
                  Get notifications for nearby activity
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30, gap: 12 }}>
          <Pressable
            onPress={handleEnableNotifications}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#ccc' : '#4A90E2',
              paddingVertical: 18,
              borderRadius: 30,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
            }}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={{
                  color: 'white',
                  fontSize: 18,
                  fontWeight: '600',
                }}>
                  Setting up your profile...
                </Text>
              </>
            ) : (
              <Text style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '600',
              }}>
                Continue
              </Text>
            )}
          </Pressable>
          
          <Pressable
            onPress={handleSkip}
            disabled={loading}
            style={{
              paddingVertical: 12,
              alignItems: 'center',
            }}>
            <Text style={{
              color: '#666',
              fontSize: 16,
            }}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}