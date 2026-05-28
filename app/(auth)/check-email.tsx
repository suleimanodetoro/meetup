import React from 'react';
import { View, Text, Pressable, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

/**
 * Confirmation prompt shown after sign-up while we wait for the user to
 * tap the verification link in their inbox. Pure presentation — the
 * actual verification happens in /confirm-email when the deep link fires.
 */
export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 30 }}>
        <Ionicons
          name="mail"
          size={64}
          color="#007AFF"
          style={{ alignSelf: 'center', marginBottom: 20 }}
        />
        <Text
          style={{
            fontSize: 26,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 12,
          }}>
          Check your email
        </Text>
        <View style={{ marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 15,
              color: '#444',
              textAlign: 'center',
              lineHeight: 22,
            }}>
            We sent a confirmation link to
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#111',
              textAlign: 'center',
              marginTop: 4,
              marginBottom: 12,
            }}>
            {email || 'your email address'}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#666',
              textAlign: 'center',
              lineHeight: 20,
            }}>
            Tap the link from this device to verify your account and finish
            signing in. Check your spam folder if you don't see it.
          </Text>
        </View>
        <Pressable
          onPress={() => router.replace('/signin')}
          style={{
            backgroundColor: '#007AFF',
            paddingVertical: 16,
            borderRadius: 30,
            alignItems: 'center',
          }}>
          <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>
            Back to sign in
          </Text>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}
