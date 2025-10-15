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
      // Parse optional arrays from params
      const interests = typeof params.interests === 'string'
        ? JSON.parse(params.interests as string)
        : undefined;

      const languages = typeof params.languages === 'string'
        ? JSON.parse(params.languages as string)
        : undefined;

      // Build the payload conditionally
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
      // avatar_url
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

      // Refresh onboarding status
      await refreshOnboardingStatus();
    } catch (error: any) {
      console.error('Complete profile error:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB', '#90CAF9']}
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

        <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 20 }}>
          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: 'white',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#007AFF',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 6,
            }}>
              <Text style={{ fontSize: 50 }}>🔔</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 32,
            fontWeight: 'bold',
            marginBottom: 12,
            textAlign: 'center',
            color: '#1A1A1A',
          }}>
            enable notifications
          </Text>

          <Text style={{
            fontSize: 15,
            color: '#666',
            marginBottom: 30,
            textAlign: 'center',
            lineHeight: 22,
          }}>
            stay connected with your messages and activity
          </Text>

          {/* Feature Cards */}
          <View style={{ gap: 12 }}>
            <View style={{
              backgroundColor: 'white',
              padding: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#E3F2FD',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>💬</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: 2,
                  color: '#1A1A1A',
                }}>
                  Messages
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: '#666',
                  lineHeight: 18,
                }}>
                  Get notified when someone messages you
                </Text>
              </View>
            </View>

            <View style={{
              backgroundColor: 'white',
              padding: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#E3F2FD',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>📅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: 2,
                  color: '#1A1A1A',
                }}>
                  Plan Updates
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: '#666',
                  lineHeight: 18,
                }}>
                  Stay informed about your upcoming plans
                </Text>
              </View>
            </View>

            <View style={{
              backgroundColor: 'white',
              padding: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#E3F2FD',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>🎯</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: 2,
                  color: '#1A1A1A',
                }}>
                  New Connections
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: '#666',
                  lineHeight: 18,
                }}>
                  Know when people nearby match your vibe
                </Text>
              </View>
            </View>
          </View>

          {/* Spacer to push buttons to bottom */}
          <View style={{ flex: 1 }} />
        </View>

        {/* Buttons */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 20, gap: 10 }}>
          <Pressable
            onPress={handleEnableNotifications}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#BDBDBD' : '#007AFF',
              paddingVertical: 16,
              borderRadius: 30,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
              shadowColor: '#007AFF',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: loading ? 0 : 0.3,
              shadowRadius: 12,
              elevation: loading ? 0 : 4,
            }}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={{
                  color: 'white',
                  fontSize: 17,
                  fontWeight: '600',
                }}>
                  Setting up your profile...
                </Text>
              </>
            ) : (
              <Text style={{
                color: 'white',
                fontSize: 17,
                fontWeight: '600',
              }}>
                Enable Notifications
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleSkip}
            disabled={loading}
            style={{
              paddingVertical: 10,
              alignItems: 'center',
            }}>
            <Text style={{
              color: loading ? '#BDBDBD' : '#666',
              fontSize: 15,
              fontWeight: '500',
            }}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}