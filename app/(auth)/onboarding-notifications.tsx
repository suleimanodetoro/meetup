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

  const saveProfileAndComplete = async (_notificationsEnabled: boolean) => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'User session not found');
      return;
    }

    setLoading(true);
    try {
      // Parse optional arrays from params (they might not exist if you switched to DB-first flow)
      const interests = typeof params.interests === 'string'
        ? JSON.parse(params.interests as string)
        : undefined;

      const languages = typeof params.languages === 'string'
        ? JSON.parse(params.languages as string)
        : undefined;

      // Build the payload *conditionally* so we don't clobber existing DB values with null/empty
      const profileData: Record<string, any> = {
        onboarding_completed: true,
        onboarding_step: 13,
        updated_at: new Date().toISOString(),
      };

      // Strings: add only when provided and non-empty
      const addIfString = (key: string, value: unknown) => {
        if (typeof value === 'string' && value.trim().length) {
          profileData[key] = value.trim();
        }
      };

      // Arrays (jsonb): add only if parsed and actually arrays
      const addIfArray = (key: string, value: unknown) => {
        if (Array.isArray(value)) profileData[key] = value;
      };

      // name -> full_name
      addIfString('full_name', params.name);
      // gender
      addIfString('gender', params.gender);
      // nationality code + name
      addIfString('nationality_code', params.nationality);
      addIfString('nationality', params.nationalityName);
      // bio
      addIfString('bio', params.bio);
      // avatar_url: IMPORTANT — only set if present so we don't wipe DB value
      addIfString('avatar_url', params.avatar_url);
      // meeting & gender preferences
      addIfString('meeting_preference', params.meet_preference);
      addIfString('gender_preference', params.gender_preference);
      // languages / interests (jsonb)
      addIfArray('languages', languages);
      addIfArray('interests', interests);

      // birth date (expects YYYY-MM-DD)
      if (typeof params.birthDate === 'string' && params.birthDate.length) {
        const birthDate = new Date(params.birthDate as string);
        if (!isNaN(birthDate.getTime())) {
          profileData.birth_date = birthDate.toISOString().split('T')[0];
        }
      }

      console.log('Saving complete profile (conditional):', profileData);

      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', session.user.id);

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      // Refresh onboarding status (your controller will navigate)
      await refreshOnboardingStatus();
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
