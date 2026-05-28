import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import ErrorBanner from '~/components/ErrorBanner';
import AuthHeader from '~/components/auth/AuthHeader';
import AuthInput from '~/components/auth/AuthInput';
import AuthScreen from '~/components/auth/AuthScreen';
import IconHero from '~/components/auth/IconHero';
import PrimaryButton from '~/components/auth/PrimaryButton';
import { authColors, authSpace } from '~/utils/authTheme';
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
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    setFormError(null);
    if (!password || !confirmPassword) {
      setFormError('Please fill in both password fields.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords don't match. Please re-enter both.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setDone(true);
  }

  // (1) Verifying
  if (exchanging) {
    return (
      <AuthScreen scrollable={false}>
        <View style={styles.verifyingWrap}>
          <ActivityIndicator />
          <Text style={styles.verifyingText}>Verifying link…</Text>
        </View>
      </AuthScreen>
    );
  }

  // (3) Error
  if (exchangeError) {
    return (
      <AuthScreen>
        <AuthHeader />
        <View style={styles.contentWrap}>
          <IconHero
            icon={<Ionicons name="alert-circle" size={64} color="#FF3B30" />}
            title="Link expired"
            subtitle={
              exchangeError ||
              'This reset link has expired or already been used.'
            }
          />
          <View style={styles.ctaWrap}>
            <PrimaryButton
              label="Request a new link"
              onPress={() => router.replace('/forgot-password')}
            />
          </View>
        </View>
      </AuthScreen>
    );
  }

  // (4) Success
  if (done) {
    return (
      <AuthScreen>
        <View style={styles.contentWrap}>
          <IconHero
            icon={<Ionicons name="checkmark-circle" size={64} color="#34C759" />}
            title="Password updated"
            subtitle="You can now sign in with your new password."
          />
          <View style={styles.ctaWrap}>
            <PrimaryButton
              label="Go to app"
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        </View>
      </AuthScreen>
    );
  }

  // (2) Form
  return (
    <AuthScreen>
      <AuthHeader />
      <Text style={styles.headline}>Set a new password.</Text>
      <View style={styles.fieldGroup}>
        <AuthInput
          label="New password"
          value={password}
          onChangeText={setPassword}
          type="password"
          autoFocus
        />
      </View>
      <View style={styles.fieldGroup}>
        <AuthInput
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          type="password"
        />
      </View>
      {formError ? (
        <View style={styles.bannerWrap}>
          <ErrorBanner message={formError} />
        </View>
      ) : null}
      <View style={styles.ctaWrap}>
        <PrimaryButton
          label="Update password"
          onPress={handleUpdate}
          loading={loading}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  verifyingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: {
    marginTop: authSpace.md,
    fontSize: 16,
    color: '#4A4A4A',
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: authColors.textPrimary,
    textAlign: 'left',
    marginBottom: authSpace.xl,
  },
  fieldGroup: {
    marginBottom: authSpace.lg,
  },
  bannerWrap: {
    marginBottom: authSpace.lg,
  },
  ctaWrap: {
    marginTop: authSpace.lg,
  },
});
