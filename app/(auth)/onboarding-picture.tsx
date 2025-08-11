// app/(auth)/onboarding-picture.tsx
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
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { decode } from 'base64-arraybuffer';

export default function OnboardingPictureScreen() {
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true, // Important: get base64 immediately
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        setImageUri(image.uri);
        setImageBase64(image.base64 || null); // Store base64 data
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  }

  async function uploadAvatar() {
    if (!imageUri || !imageBase64) {
      console.log('No image or base64 data available');
      return null;
    }

    try {
      setUploading(true);
      
      const fileName = `${session?.user.id}-${Date.now()}.jpg`;
      
      // Direct upload to avatars bucket - no subfolder path!
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(imageBase64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Upload successful, URL:', publicUrl);
      return publicUrl;
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error.message || 'Failed to upload avatar');
      return null;
    } finally {
      setUploading(false);
    }
  }

  const handleContinue = async () => {
    let avatarUrl = null;
    
    if (imageUri && imageBase64) {
      avatarUrl = await uploadAvatar();
      // Only proceed if upload was successful or user had no image
      if (!avatarUrl && imageUri) {
        // Upload failed but user had selected an image
        return; // Don't navigate
      }
    }

    // Navigate to languages screen
    router.push({
      pathname: '/onboarding-languages',
      params: {
        ...params,
        avatar_url: avatarUrl || '',
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding-languages',
      params: {
        ...params,
        avatar_url: '',
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
            add a picture
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 40,
          }}>
            let others know what you look like 📸
          </Text>

          {/* Camera decoration */}
          <View style={{ position: 'absolute', right: 30, top: 100 }}>
            <Text style={{ fontSize: 60 }}>📷</Text>
            <View style={{
              position: 'absolute',
              top: -10,
              right: -10,
              backgroundColor: '#FFD700',
              width: 30,
              height: 30,
              borderRadius: 15,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 20 }}>✨</Text>
            </View>
          </View>

          {/* Image Upload Area */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Pressable
              onPress={pickImage}
              disabled={uploading}
              style={{
                width: 280,
                height: 280,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: '#4A90E2',
                borderStyle: 'dashed',
                backgroundColor: 'white',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                opacity: uploading ? 0.6 : 1,
              }}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                />
              ) : (
                <View style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: '#E3F2FD',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 30, color: '#4A90E2' }}>+</Text>
                </View>
              )}
            </Pressable>

            {imageUri && !uploading && (
              <Pressable
                onPress={pickImage}
                style={{
                  marginTop: 20,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  backgroundColor: 'white',
                  borderRadius: 20,
                }}>
                <Text style={{ color: '#4A90E2', fontWeight: '600' }}>
                  Change Photo
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
          <Pressable
            onPress={handleContinue}
            disabled={uploading}
            style={{
              backgroundColor: uploading ? '#ccc' : '#4A90E2',
              paddingVertical: 18,
              borderRadius: 30,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
            }}>
            {uploading ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text style={{
                  color: 'white',
                  fontSize: 18,
                  fontWeight: '600',
                }}>
                  Uploading...
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
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}