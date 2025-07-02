import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  Button,
  Alert,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { v4 as uuidv4 } from 'uuid';

import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';

export default function Profile() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // load profile on mount / session change
  useEffect(() => {
    if (userId) getProfile();
  }, [userId]);

  async function getProfile() {
    try {
      setLoading(true);
      const { data, error, status } = await supabase
        .from('profiles')
        .select('username,full_name,website,avatar_url')
        .eq('id', userId)
        .single();

      if (error && status !== 406) throw error;

      if (data) {
        setUsername(data.username || '');
        setFullName(data.full_name || '');
        setWebsite(data.website || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (error: any) {
      Alert.alert('Error loading profile', error.message);
    } finally {
      setLoading(false);
    }
  }

  // pick an image and upload it
  async function pickAvatar() {
    try {
      // 1. Ask for media-library permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission denied',
          'We need access to your photo library to upload an avatar.'
        );
        return;
      }
  
      // 2. Launch the image picker — now takes a string or array of strings
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],       // ← pick only images :contentReference[oaicite:0]{index=0}
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
  
      // 3. Bail out if the user canceled
      if (result.canceled) return;     // ← uses `canceled` and `assets` per docs :contentReference[oaicite:1]{index=1}
  
      // 4. Grab the first asset’s URI
      const localUri = result.assets[0].uri;
  
      // 5. Upload flow
      setUploading(true);
      const response = await fetch(localUri);
      const blob = await response.blob();
      const filename = `${userId}/${uuidv4()}`;
      const { error: uploadError } = await supabase
        .storage
        .from('avatars')
        .upload(filename, blob, { upsert: true });
      setUploading(false);
  
      if (uploadError) throw uploadError;
  
      // 6. Get and store the public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filename);
      setAvatarUrl(data.publicUrl);
      Alert.alert('Success', 'Avatar uploaded!');
    } catch (error: any) {
      setUploading(false);
      Alert.alert('Upload failed', error.message);
    }
  }
  
  

  // update profile row
  async function updateProfile() {
    try {
      setLoading(true);
      const updates = {
        id: userId,
        username,
        full_name: fullName,
        website,
        avatar_url: avatarUrl,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      Alert.alert('Success', 'Profile updated.');
      await getProfile();
    } catch (error: any) {
      Alert.alert('Update failed', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white p-5">
      <Stack.Screen options={{ title: 'Profile' }} />

      {loading && <ActivityIndicator style={{ marginVertical: 10 }} />}

      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 100, height: 100, borderRadius: 50 }}
          />
        ) : (
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#eee',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text>No avatar</Text>
          </View>
        )}
        <Pressable
          onPress={pickAvatar}
          disabled={uploading}
          style={{
            marginTop: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: '#007AFF',
            borderRadius: 4,
          }}
        >
          {uploading
            ? <ActivityIndicator />
            : <Text style={{ color: '#007AFF' }}>Change Avatar</Text>}
        </Pressable>
      </View>

      <TextInput
        editable={false}
        value={session?.user.email}
        placeholder="Email"
        autoCapitalize="none"
        className="rounded-md border border-gray-200 p-3 text-gray-700 mb-3"
      />

      <TextInput
        onChangeText={setUsername}
        value={username}
        placeholder="Username"
        autoCapitalize="none"
        className="rounded-md border border-gray-200 p-3 mb-3"
      />

      <TextInput
        onChangeText={setFullName}
        value={fullName}
        placeholder="Full Name"
        autoCapitalize="none"
        className="rounded-md border border-gray-200 p-3 mb-3"
      />

      <TextInput
        onChangeText={setWebsite}
        value={website}
        placeholder="Website"
        autoCapitalize="none"
        className="rounded-md border border-gray-200 p-3 mb-5"
      />

      <Pressable
        onPress={updateProfile}
        disabled={loading}
        style={{
          alignItems: 'center',
          paddingVertical: 12,
          backgroundColor: loading ? '#ccc' : '#E53E3E',
          borderRadius: 4,
          marginBottom: 10,
        }}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Update Profile</Text>}
      </Pressable>

      <Button
        title="Sign Out"
        onPress={() => supabase.auth.signOut()}
      />
    </View>
  );
}
