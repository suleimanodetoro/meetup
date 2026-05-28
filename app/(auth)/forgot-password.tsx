import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: 'waypoint://reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setSent(true);
  }

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            onPress={() => router.back()}
            style={{ padding: 16, alignSelf: 'flex-start' }}
            hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </Pressable>

          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>
            <Ionicons
              name="lock-closed"
              size={56}
              color="#007AFF"
              style={{ alignSelf: 'center', marginBottom: 16 }}
            />
            <Text
              style={{
                fontSize: 26,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 12,
              }}>
              Reset your password
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: '#666',
                textAlign: 'center',
                marginBottom: 28,
                lineHeight: 22,
              }}>
              {sent
                ? `We sent a reset link to ${email}. Open it from this device to set a new password.`
                : "Enter your account email and we'll send you a link to set a new password."}
            </Text>

            {!sent ? (
              <>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: 'white',
                    padding: 16,
                    borderRadius: 12,
                    fontSize: 16,
                    marginBottom: 16,
                  }}
                />
                <Pressable
                  onPress={handleReset}
                  disabled={loading}
                  style={{
                    backgroundColor: loading ? '#ccc' : '#007AFF',
                    paddingVertical: 16,
                    borderRadius: 30,
                    alignItems: 'center',
                  }}>
                  <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => router.replace('/signin')}
                style={{ alignItems: 'center', padding: 12 }}>
                <Text style={{ color: '#007AFF', fontSize: 15 }}>Back to sign in</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
