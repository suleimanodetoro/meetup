// app/(auth)/onboarding-gender-preference.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingGenderPreferenceScreen() {
  const params = useLocalSearchParams();
  const [genderPreference, setGenderPreference] = useState('everyone');

  const genderOptions = [
    { id: 'guys', label: 'Only Guys', emoji: '🧔' },
    { id: 'girls', label: 'Only Girls', emoji: '👩' },
    { id: 'everyone', label: 'Everyone', emoji: '👫' },
  ];

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding-trips',
      params: {
        ...params,
        gender_preference: genderPreference,
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

        <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 40 }}>
          {/* Title */}
          <Text style={{
            fontSize: 32,
            fontWeight: 'bold',
            marginBottom: 8,
          }}>
            who do you want to meet?
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 50,
          }}>
            you will only receive messages from this gender 😎
          </Text>

          {/* Gender Options */}
          <View style={{ gap: 16 }}>
            {genderOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setGenderPreference(option.id)}
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  borderWidth: 2,
                  borderColor: genderPreference === option.id ? '#4A90E2' : 'white',
                }}>
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: genderPreference === option.id ? '#E3F2FD' : '#F5F5F5',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 24 }}>{option.emoji}</Text>
                </View>
                <Text style={{
                  fontSize: 17,
                  flex: 1,
                  color: '#333',
                  fontWeight: genderPreference === option.id ? '600' : '400',
                }}>
                  {option.label}
                </Text>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: genderPreference === option.id ? '#4A90E2' : '#E0E0E0',
                  backgroundColor: genderPreference === option.id ? '#4A90E2' : 'white',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {genderPreference === option.id && (
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: 'white',
                    }} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
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