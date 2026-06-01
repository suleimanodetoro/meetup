// app/(auth)/forgot-password.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AuthHeader from '../../components/auth/AuthHeader';
import AuthInput from '../../components/auth/AuthInput';
import AuthScreen from '../../components/auth/AuthScreen';
import IconHero from '../../components/auth/IconHero';
import PrimaryButton from '../../components/auth/PrimaryButton';
import SecondaryButton from '../../components/auth/SecondaryButton';
import ErrorBanner from '../../components/ErrorBanner';
import { authColors, authSpace } from '../../utils/authTheme';
import { supabase } from '~/utils/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_MS = 30_000;
const RESET_PASSWORD_REDIRECT = 'waypoint:///reset-password';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState('');
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Tick once a second while the resend cooldown is active so the
  // countdown label re-renders. Interval is cleared as soon as we
  // leave the cooldown window (or unmount).
  useEffect(() => {
    if (lastSentAt == null) return;
    const elapsed = Date.now() - lastSentAt;
    if (elapsed >= RESEND_COOLDOWN_MS) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastSentAt, now]);

  const remainingMs = lastSentAt == null ? 0 : Math.max(0, RESEND_COOLDOWN_MS - (now - lastSentAt));
  const remainingSec = Math.ceil(remainingMs / 1000);
  const cooling = remainingMs > 0;

  async function handleReset() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: RESET_PASSWORD_REDIRECT,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSentEmail(trimmed);
    setSent(true);
    setLastSentAt(Date.now());
    setNow(Date.now());
  }

  async function handleResend() {
    if (cooling || loading) return;
    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(sentEmail, {
      redirectTo: RESET_PASSWORD_REDIRECT,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setLastSentAt(Date.now());
    setNow(Date.now());
  }

  return (
    <AuthScreen>
      <AuthHeader />
      {sent ? (
        <View style={styles.content}>
          <IconHero
            icon={<Ionicons name="checkmark-circle" size={64} color={authColors.success} />}
            title="Check your inbox"
            subtitle={`We sent a reset link to ${sentEmail}. Tap it to set a new password.`}
          />
          <View style={styles.actions}>
            <ErrorBanner message={error} />
            <SecondaryButton
              label={cooling ? `Resend in ${remainingSec}s…` : 'Resend link'}
              onPress={handleResend}
              loading={loading}
              disabled={cooling}
            />
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <IconHero
            icon={<Ionicons name="mail-outline" size={64} color={authColors.textPrimary} />}
            title="Forgot your password?"
            subtitle="Enter your email and we'll send you a link to reset it."
          />
          <View style={styles.form}>
            <ErrorBanner message={error} />
            <AuthInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              type="email"
              placeholder="you@example.com"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleReset}
            />
            <PrimaryButton label="Send reset link" onPress={handleReset} loading={loading} />
          </View>
        </View>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  form: {
    marginTop: authSpace.xxl,
    gap: authSpace.lg,
  },
  actions: {
    marginTop: authSpace.xxl,
    gap: authSpace.lg,
  },
});
