// app/(auth)/onboarding-location.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';

export default function OnboardingLocationScreen() {
  const params = useLocalSearchParams();
  const [loading, setLoading] = useState(false);

  const handleEnableLocation = async () => {
    setLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status === 'granted') {
      router.push({
        pathname: '/onboarding-notifications',
        params: {
          ...params,
          location_enabled: 'true',
        },
      });
    } else {
      router.push({
        pathname: '/onboarding-notifications',
        params: {
          ...params,
          location_enabled: 'false',
        },
      });
    }
    setLoading(false);
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding-notifications',
      params: {
        ...params,
        location_enabled: 'false',
      },
    });
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
            <Text style={{ fontSize: 80 }}>🧭</Text>
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 36,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center',
          }}>
            enable location services
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 40,
            textAlign: 'center',
          }}>
            find travelers near you & discover local events
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
                <Text style={{ fontSize: 24 }}>👋</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 4,
                }}>
                  Nearby travelers
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#666',
                }}>
                  Connect with travelers near you
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
                <Text style={{ fontSize: 24 }}>☕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  marginBottom: 4,
                }}>
                  Local activities
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#666',
                }}>
                  Discover trips and nearby activities
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30, gap: 12 }}>
          <Pressable
            onPress={handleEnableLocation}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#ccc' : '#4A90E2',
              paddingVertical: 18,
              borderRadius: 30,
              alignItems: 'center',
            }}>
            <Text style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '600',
            }}>
              {loading ? 'Requesting...' : 'Continue'}
            </Text>
          </Pressable>
          
          <Pressable
            onPress={handleSkip}
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