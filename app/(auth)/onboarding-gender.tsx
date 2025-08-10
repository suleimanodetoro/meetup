// app/(auth)/onboarding-gender.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';

export default function OnboardingGenderScreen() {
  const params = useLocalSearchParams();
  const { session, refreshOnboardingStatus } = useAuth();
  const [selectedGender, setSelectedGender] = useState('');
  const [loading, setLoading] = useState(false);

  const genderOptions = [
    { id: 'male', label: 'Male', emoji: '🙋‍♂️' },
    { id: 'female', label: 'Female', emoji: '🙋‍♀️' },
    { id: 'other', label: 'Other', emoji: '🦄' },
  ];

  const handleComplete = async () => {
    if (!selectedGender || !session?.user) return;
    
    setLoading(true);
    try {
      // Parse the birth date properly
      const birthDate = new Date(params.birthDate as string);
      const formattedBirthDate = birthDate.toISOString().split('T')[0];

      // Save all collected data to the profile
      const profileData = {
        full_name: params.name as string,
        birth_date: formattedBirthDate,
        gender: selectedGender,
        nationality: params.nationalityName as string,
        nationality_code: params.nationality as string,
        onboarding_completed: true,
        onboarding_step: 3,
        updated_at: new Date().toISOString(),
      };

      console.log('Updating profile with:', profileData);

      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', session.user.id);

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }
      
      console.log('Profile updated successfully');
      
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
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
            <Text style={{ fontSize: 30 }}>←</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 30 }}>
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
            marginBottom: 40,
          }}>
            helps us connect you with other travelers 🤝
          </Text>

          {/* Photo Collage Background */}
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-around',
            marginBottom: 40,
            opacity: 0.6,
          }}>
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1530268729831-4b0b9e170218?w=200' }}
                style={{ width: 100, height: 100, borderRadius: 20 }}
              />
            </View>
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200' }}
                style={{ width: 100, height: 100, borderRadius: 20 }}
              />
            </View>
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1581803118522-7b72a50f7e9f?w=200' }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            </View>
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200' }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            </View>
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=200' }}
                style={{ width: 100, height: 100, borderRadius: 20 }}
              />
            </View>
            <View style={{ marginBottom: 10 }}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=200' }}
                style={{ width: 100, height: 100, borderRadius: 20 }}
              />
            </View>
          </View>

          {/* Gender Options */}
          <View style={{ gap: 16 }}>
            {genderOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setSelectedGender(option.id)}
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: selectedGender === option.id ? '#4A90E2' : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Text style={{ fontSize: 28 }}>{option.emoji}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '500' }}>
                    {option.label}
                  </Text>
                </View>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selectedGender === option.id ? '#4A90E2' : '#ddd',
                  backgroundColor: selectedGender === option.id ? '#4A90E2' : 'white',
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

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
          <Pressable
            onPress={handleComplete}
            disabled={!selectedGender || loading}
            style={{
              backgroundColor: selectedGender && !loading ? '#4A90E2' : '#ccc',
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
                Complete Profile
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}