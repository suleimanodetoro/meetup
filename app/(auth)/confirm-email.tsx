import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '~/utils/supabase';

/**
 * Deep-link target for the post-signup confirmation email.
 *
 * URL shape: waypoint://confirm-email?code=<one-time-pkce-code>
 *
 * Exchange the code for a session, then hand off to NavigationController —
 * a verified, signed-in user will be routed to onboarding (if they haven't
 * completed it) or to the tabs.
 */
export default function ConfirmEmailScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code) {
      setError('Missing confirmation code. Open the link from your email again.');
      return;
    }
    void (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }
      setDone(true);
      // NavigationController will pick up the new authenticated session and
      // route to onboarding or /(tabs). We give it a tick to react.
      setTimeout(() => router.replace('/(tabs)'), 150);
    })();
  }, [code]);

  if (error) {
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
            Couldn't verify
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: '#666',
              textAlign: 'center',
              marginBottom: 24,
            }}>
            {error}
          </Text>
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

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
        {done ? (
          <>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={{ marginTop: 16, fontSize: 20, fontWeight: '600' }}>
              Email verified
            </Text>
            <Text style={{ marginTop: 8, color: '#666' }}>Signing you in…</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={{ marginTop: 16, color: '#666' }}>Verifying your email…</Text>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}
