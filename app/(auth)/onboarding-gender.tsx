// app/(auth)/onboarding-gender.tsx
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

export default function OnboardingGenderScreen() {
  const params = useLocalSearchParams();
  const [selectedGender, setSelectedGender] = useState<string>('');

  const genderOptions = [
    { id: 'male', label: 'Male', emoji: '👨' },
    { id: 'female', label: 'Female', emoji: '👩' },
    { id: 'other', label: 'Other', emoji: '✨' },
  ];

  const handleContinue = () => {
    if (!selectedGender) return;
    router.push({
      pathname: '/onboarding-interests',
      params: { ...params, gender: selectedGender },
    });
  };

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
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
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}>
          
          <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 40 }}>
            {/* Title */}
            <Text style={{
              fontSize: 36,
              fontWeight: 'bold',
              marginBottom: 8,
            }}>
              what's your gender?
            </Text>
            
            <Text style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 50,
            }}>
              helps us connect you with the right people 🤝
            </Text>

            {/* Gender Options */}
            <View style={{ gap: 16 }}>
              {genderOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedGender(option.id)}
                  style={{
                    backgroundColor: 'white',
                    padding: 24,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    borderWidth: 2,
                    borderColor: selectedGender === option.id ? '#007AFF' : 'white',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}>
                  <View style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: selectedGender === option.id ? '#E3F2FD' : '#F5F5F5',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 28 }}>{option.emoji}</Text>
                  </View>
                  <Text style={{
                    fontSize: 18,
                    flex: 1,
                    color: '#333',
                    fontWeight: selectedGender === option.id ? '600' : '400',
                  }}>
                    {option.label}
                  </Text>
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selectedGender === option.id ? '#007AFF' : '#E0E0E0',
                    backgroundColor: selectedGender === option.id ? '#007AFF' : 'white',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    {selectedGender === option.id && (
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
        </ScrollView>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
          <Pressable
            onPress={handleContinue}
            disabled={!selectedGender}
            style={{
              backgroundColor: selectedGender ? '#007AFF' : '#ccc',
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