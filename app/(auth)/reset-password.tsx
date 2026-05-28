import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '~/utils/supabase';

/**
 * Deep-link target for the password recovery email.
 *
 * URL shape: waypoint://reset-password?code=<one-time-pkce-code>
 *
 * We exchange the code for a recovery session, then let the user set a new
 * password. NavigationController whitelists this route specifically so the
 * "you're now authenticated, get out of (auth)" rule doesn't bounce us
 * mid-flow.
 */
export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setExchangeError(
        'Missing recovery code. Open the link from your reset email again.',
      );
      setExchanging(false);
      return;
    }
    void (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setExchangeError(error.message);
      }
      setExchanging(false);
    })();
  }, [code]);

  async function handleUpdate() {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Please re-enter both.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Password updated', "You're now signed in.", [
      { text: 'OK', onPress: () => router.replace('/(tabs)') },
    ]);
  }

  if (exchanging) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#E3F2FD',
        }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (exchangeError) {
    return (
      <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 30 }}>
          <Ionicons
            name="alert-circle"
            size={56}
            color="#FF3B30"
            style={{ alignSelf: 'center', marginBottom: 16 }}
          />
          <Text
            style={{
              fontSize: 22,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 12,
            }}>
            Recovery link invalid
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#666',
              textAlign: 'center',
              marginBottom: 24,
            }}>
            {exchangeError}
          </Text>
          <Pressable
            onPress={() => router.replace('/forgot-password')}
            style={{
              backgroundColor: '#007AFF',
              paddingVertical: 16,
              borderRadius: 30,
              alignItems: 'center',
            }}>
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>
              Request a new link
            </Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>
            <Ionicons
              name="key"
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
              Choose a new password
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: '#666',
                textAlign: 'center',
                marginBottom: 28,
              }}>
              At least 6 characters.
            </Text>

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: 'white',
                padding: 16,
                borderRadius: 12,
                fontSize: 16,
                marginBottom: 12,
              }}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
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
              onPress={handleUpdate}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#ccc' : '#007AFF',
                paddingVertical: 16,
                borderRadius: 30,
                alignItems: 'center',
              }}>
              <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>
                {loading ? 'Saving…' : 'Save new password'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
