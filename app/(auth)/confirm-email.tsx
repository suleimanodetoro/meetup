// app/(auth)/confirm-email.tsx
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AuthHeader from '../../components/auth/AuthHeader';
import AuthScreen from '../../components/auth/AuthScreen';
import IconHero from '../../components/auth/IconHero';
import PrimaryButton from '../../components/auth/PrimaryButton';
import { authColors, authSpace } from '../../utils/authTheme';
import { supabase } from '~/utils/supabase';

/**
 * Deep-link target for the post-signup confirmation email.
 *
 * URL shape: waypoint://confirm-email?code=<one-time-pkce-code>
 *
 * Exchange the code for a session, then hand off to NavigationController —
 * a verified, signed-in user will be routed to onboarding (if they haven't
 * completed it) or to the tabs.
 *
 * State machine:
 *   1. Verifying — running exchangeCodeForSession
 *   2. Success   — session established; NavigationController takes over
 *   3. Error     — bad/expired/missing code
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
    })();
  }, [code]);

  // (3) Error
  if (error) {
    return (
      <AuthScreen scrollable={false}>
        <AuthHeader onBack={() => router.replace('/signin')} />

        <View style={styles.body}>
          <IconHero
            icon={<Ionicons name="alert-circle" size={64} color={authColors.error} />}
            title="Confirmation failed"
            subtitle={error || 'This confirmation link is invalid or has expired.'}
          />

          <View style={styles.actions}>
            <PrimaryButton label="Try again" onPress={() => router.replace('/signin')} />
          </View>
        </View>
      </AuthScreen>
    );
  }

  // (2) Success
  if (done) {
    return (
      <AuthScreen scrollable={false}>
        <View style={styles.body}>
          <IconHero
            icon={<Ionicons name="checkmark-circle" size={64} color={authColors.success} />}
            title="Email confirmed"
            subtitle="Welcome to Waypoint."
          />

          <View style={styles.actions}>
            <PrimaryButton
              label="Continue"
              onPress={() => {
                // AuthProvider's listener should have already set
                // isAuthenticated=true and NavigationController will route
                // into onboarding automatically. As a fallback, jump there
                // ourselves.
                router.replace('/(auth)/onboarding/basic');
              }}
            />
          </View>
        </View>
      </AuthScreen>
    );
  }

  // (1) Verifying
  return (
    <AuthScreen scrollable={false}>
      <View style={styles.verifying}>
        <ActivityIndicator size="large" color={authColors.textPrimary} />
        <Text style={styles.verifyingText}>Confirming your email…</Text>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  actions: {
    marginTop: authSpace.xxl,
    alignItems: 'center',
    width: '100%',
  },
  verifying: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: {
    marginTop: authSpace.lg,
    fontSize: 16,
    color: authColors.textSecondary,
    textAlign: 'center',
  },
});
