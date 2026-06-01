// app/(auth)/check-email.tsx
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AuthHeader from '../../components/auth/AuthHeader';
import AuthScreen from '../../components/auth/AuthScreen';
import IconHero from '../../components/auth/IconHero';
import SecondaryButton from '../../components/auth/SecondaryButton';
import ErrorBanner from '../../components/ErrorBanner';
import { authColors, authSpace, authType } from '../../utils/authTheme';
import { supabase } from '~/utils/supabase';

const RESEND_COOLDOWN_MS = 30_000;
const CONFIRM_EMAIL_REDIRECT = 'waypoint:///confirm-email';

/**
 * Confirmation prompt shown after sign-up while we wait for the user to tap
 * the verification link in their inbox. The link is handled by /confirm-email
 * via deep link. This screen lets the user re-trigger the email if it never
 * arrived.
 *
 * Success-state UX choice: rather than introduce a green-variant banner, we
 * render a single muted line under the Resend button ("Resent. Check your
 * inbox.") whenever the last resend succeeded. It's the simpler option — no
 * new component variant, no extra dismissal logic — and it sits naturally
 * next to the cooldown countdown that's already in that spot.
 */
export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  // Start cooldown on mount so a user who just signed up can't immediately
  // re-tap and spam Supabase. Supabase itself rate-limits anyway, but doing
  // this in the UI is much friendlier than surfacing the API error.
  const [lastSentAt, setLastSentAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resentOk, setResentOk] = useState(false);

  // Tick once per second while the cooldown is active. We deliberately don't
  // run the interval forever — once the cooldown is up there's nothing on
  // screen that depends on `now`.
  useEffect(() => {
    const remaining = RESEND_COOLDOWN_MS - (Date.now() - lastSentAt);
    if (remaining <= 0) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastSentAt]);

  const msRemaining = Math.max(0, RESEND_COOLDOWN_MS - (now - lastSentAt));
  const secondsRemaining = Math.ceil(msRemaining / 1000);
  const isCoolingDown = msRemaining > 0;

  const subtitle = email
    ? `We sent a confirmation link to ${email}. Tap it to finish creating your account.`
    : 'We sent a confirmation link to your inbox.';

  const resendLabel = isCoolingDown ? `Resend in ${secondsRemaining}s…` : 'Resend email';

  async function handleResend() {
    if (!email) {
      setError("We don't have your email on file. Go back and sign up again.");
      return;
    }
    setError(null);
    setResentOk(false);
    setLoading(true);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: CONFIRM_EMAIL_REDIRECT },
    });
    setLoading(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setLastSentAt(Date.now());
    setNow(Date.now());
    setResentOk(true);
  }

  return (
    <AuthScreen scrollable={false}>
      <AuthHeader onBack={() => router.replace('/welcome')} />

      <View style={styles.body}>
        <IconHero
          icon={<Ionicons name="mail-outline" size={64} color={authColors.textPrimary} />}
          title="Confirm your email"
          subtitle={subtitle}
        />

        <View style={styles.actions}>
          {error ? (
            <View style={styles.bannerWrap}>
              <ErrorBanner message={error} />
            </View>
          ) : null}

          <SecondaryButton
            label={resendLabel}
            onPress={handleResend}
            loading={loading}
            disabled={isCoolingDown}
          />

          {resentOk ? (
            <Text style={styles.success} accessibilityLiveRegion="polite">
              Resent. Check your inbox.
            </Text>
          ) : null}

          <Pressable
            onPress={() => router.replace('/signup')}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Wrong email? Sign up again"
            accessibilityState={{ disabled: loading }}
            style={[styles.wrongEmail, loading ? styles.wrongEmailDisabled : null]}>
            <Text style={styles.wrongEmailText}>Wrong email? Sign up again</Text>
          </Pressable>
        </View>
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
  bannerWrap: {
    width: '100%',
    marginBottom: authSpace.lg,
  },
  success: {
    marginTop: authSpace.md,
    fontSize: 14,
    color: authColors.textSecondary,
    textAlign: 'center',
  },
  wrongEmail: {
    marginTop: authSpace.xl,
    paddingVertical: authSpace.sm,
  },
  wrongEmailPressed: {
    opacity: 0.6,
  },
  wrongEmailDisabled: {
    opacity: 0.5,
  },
  wrongEmailText: {
    fontSize: authType.link.fontSize,
    fontWeight: authType.link.fontWeight,
    color: authColors.accent,
    textDecorationLine: 'underline',
    textDecorationColor: authColors.accent,
  },
});
