// app/(auth)/onboarding-bio.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingBioScreen() {
  const params = useLocalSearchParams();
  const [bio, setBio] = useState('');
  const maxLength = 300;

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding-preferences',
      params: {
        ...params,
        bio: bio.trim(),
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding-preferences',
      params: {
        ...params,
        bio: '',
      },
    });
  };

  return (
    <LinearGradient
      colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 10,
          }}>
            <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
              <Text style={{ fontSize: 30 }}>←</Text>
            </Pressable>
            <Pressable onPress={handleSkip} style={{ padding: 10 }}>
              <Text style={{ fontSize: 16, color: '#666' }}>Skip</Text>
            </Pressable>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 40 }}>
            {/* Title */}
            <Text style={{
              fontSize: 36,
              fontWeight: 'bold',
              marginBottom: 8,
            }}>
              tell us a bit about yourself
            </Text>
            
            <Text style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 40,
            }}>
              what should others know 👀
            </Text>

            {/* Pencil decoration */}
            <View style={{ position: 'absolute', right: 30, top: 100 }}>
              <Text style={{ fontSize: 60 }}>✏️</Text>
            </View>

            {/* Bio Input */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 16,
              minHeight: 200,
              maxHeight: 300,
              borderWidth: 2,
              borderColor: bio.length > 0 ? '#007AFF' : '#E0E0E0',
            }}>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="What should other travelers know about you?"
                placeholderTextColor="#9E9E9E"
                multiline
                maxLength={maxLength}
                style={{
                  fontSize: 16,
                  lineHeight: 24,
                  color: '#333',
                  textAlignVertical: 'top',
                  minHeight: 160,
                }}
              />
              
              {/* Character Counter */}
              <Text style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                fontSize: 12,
                color: bio.length > maxLength * 0.9 ? '#FF6B6B' : '#9E9E9E',
              }}>
                {bio.length}/{maxLength}
              </Text>
            </View>

            {/* Writing Tips */}
            <View style={{ marginTop: 20 }}>
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                💡 Tips:
              </Text>
              <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                • Share what kind of traveler you are
              </Text>
              <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                • Mention your favorite travel experiences
              </Text>
              <Text style={{ fontSize: 13, color: '#666' }}>
                • Tell us what you love to do when exploring
              </Text>
            </View>
          </View>

          {/* Continue Button */}
          <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
            <Pressable
              onPress={handleContinue}
              style={{
                backgroundColor: '#007AFF',
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}