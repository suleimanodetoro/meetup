// app/(auth)/onboarding-preferences.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingPreferencesScreen() {
  const params = useLocalSearchParams();
  const [meetPreference, setMeetPreference] = useState('travel-together');

  const meetOptions = [
    { id: 'travel-together', label: 'Travel together', emoji: '✈️' },
    { id: 'meet-there', label: 'Meet while I\'m there', emoji: '📍' },
    { id: 'message-first', label: 'Message before making plans', emoji: '💬' },
    { id: 'no-plans', label: 'No plans to meet yet', emoji: '✨' }
  ];

  const handleContinue = () => {
    // Navigate to the SEPARATE gender preference screen
    router.push({
      pathname: '/onboarding-gender-preference',
      params: {
        ...params,
        meet_preference: meetPreference,
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

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 30, paddingTop: 30 }}>
            {/* Title */}
            <Text style={{
              fontSize: 32,
              fontWeight: 'bold',
              marginBottom: 8,
            }}>
              how do you prefer to meet travelers?
            </Text>
            
            <Text style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 40,
            }}>
              help us connect you with people who match your vibe 🤝
            </Text>

            {/* Pencil decoration */}
            <View style={{ position: 'absolute', right: 30, top: 100 }}>
              <Text style={{ fontSize: 60 }}>✏️</Text>
            </View>

            {/* Meeting Options */}
            <View style={{ gap: 16 }}>
              {meetOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setMeetPreference(option.id)}
                  style={{
                    backgroundColor: 'white',
                    padding: 20,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    borderWidth: 2,
                    borderColor: meetPreference === option.id ? '#4A90E2' : 'white',
                  }}>
                  <View style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: meetPreference === option.id ? '#E3F2FD' : '#F5F5F5',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 24 }}>{option.emoji}</Text>
                  </View>
                  <Text style={{
                    fontSize: 17,
                    flex: 1,
                    color: '#333',
                    fontWeight: meetPreference === option.id ? '600' : '400',
                  }}>
                    {option.label}
                  </Text>
                  {meetPreference === option.id && (
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#4A90E2',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'white',
                      }} />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Continue Button - Fixed at bottom */}
        <View style={{ 
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 30, 
          paddingBottom: 30,
          backgroundColor: 'transparent',
        }}>
          <Pressable
            onPress={handleContinue}
            style={{
              backgroundColor: '#4A90E2',
              paddingVertical: 18,
              borderRadius: 30,
              alignItems: 'center',
            }}>
            <Text style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '600',
            }}>
              Continue
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}