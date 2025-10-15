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
  ScrollView,
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
      colors={['#E3F2FD', '#BBDEFB', '#90CAF9']}
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          
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
              <Text style={{ fontSize: 16, color: '#666', fontWeight: '600' }}>Skip</Text>
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled">
            
            <View style={{ paddingHorizontal: 30, paddingTop: 20, paddingBottom: 20 }}>
              {/* Title */}
              <Text style={{
                fontSize: 36,
                fontWeight: 'bold',
                marginBottom: 8,
              }}>
                tell us about yourself
              </Text>
              
              <Text style={{
                fontSize: 16,
                color: '#666',
                marginBottom: 40,
              }}>
                what should people know 👀
              </Text>

              {/* Pencil decoration */}
              <View style={{ position: 'absolute', right: 30, top: 60, zIndex: -1 }}>
                <Text style={{ fontSize: 60 }}>✏️</Text>
              </View>

              {/* Bio Input */}
              <View style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 16,
                minHeight: 200,
                borderWidth: 2,
                borderColor: bio.length > 0 ? '#007AFF' : '#E0E0E0',
                marginBottom: 20,
              }}>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Share a bit about yourself..."
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
                  alignSelf: 'flex-end',
                  marginTop: 8,
                  fontSize: 12,
                  color: bio.length > maxLength * 0.9 ? '#FF6B6B' : '#9E9E9E',
                }}>
                  {bio.length}/{maxLength}
                </Text>
              </View>

              {/* Writing Tips */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                  💡 Tips:
                </Text>
                <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  • Share what makes you unique
                </Text>
                <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
                  • Mention your hobbies and interests
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>
                  • Tell us what you love to do for fun
                </Text>
              </View>

              {/* Continue Button - Now inside ScrollView */}
              <Pressable
                onPress={handleContinue}
                style={{
                  backgroundColor: '#007AFF',
                  paddingVertical: 18,
                  borderRadius: 30,
                  alignItems: 'center',
                  marginTop: 10,
                  shadowColor: '#007AFF',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 4,
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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}