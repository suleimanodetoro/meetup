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
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { decode } from 'base64-arraybuffer';
import { pickAndEncodeImage } from '~/utils/pickAndEncodeImage';

export default function OnboardingPictureScreen() {
  const params = useLocalSearchParams();
  const { session } = useAuth();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickImage() {
    try {
      // Same UX: 1:1 crop, similar compression; util guarantees base64
      const picked = await pickAndEncodeImage([1, 1], 2000, 0.5);
      if (!picked) return;
      setImageUri(picked.uri);
      setImageBase64(picked.base64);
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', error?.message || 'Failed to pick image');
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

      // Upload to avatars bucket, same as before
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(imageBase64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Upload successful, URL:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error?.message || 'Failed to upload avatar');
      return null;
    } finally {
      setUploading(false);
    }
  }

  const handleContinue = async () => {
    let avatarUrl: string | null = null;

    if (imageUri && imageBase64) {
      avatarUrl = await uploadAvatar();
      if (!avatarUrl && imageUri) return; // don’t navigate if upload failed after selection
    }

    // Keep passing avatar_url via params (unchanged flow)
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
          <Text style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 8 }}>
            add a picture
          </Text>

          <Text style={{ fontSize: 16, color: '#666', marginBottom: 40 }}>
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
                borderColor: '#007AFF',
                borderStyle: 'dashed',
                backgroundColor: 'white',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                opacity: uploading ? 0.6 : 1,
              }}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: '#E3F2FD',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 30, color: '#007AFF' }}>+</Text>
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
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>
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
              backgroundColor: uploading ? '#ccc' : '#007AFF',
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
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
                  Uploading...
                </Text>
              </>
            ) : (
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
                Continue
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
