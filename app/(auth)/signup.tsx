// app/(auth)/signup.tsx
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import AuthHeader from '~/components/auth/AuthHeader';
import AuthInput from '~/components/auth/AuthInput';
import AuthScreen from '~/components/auth/AuthScreen';
import PrimaryButton from '~/components/auth/PrimaryButton';
import ErrorBanner from '~/components/ErrorBanner';
import { authColors, authSpace } from '~/utils/authTheme';
import { supabase } from '~/utils/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TERMS_URL = 'https://usewaypoint.app/terms';
const PRIVACY_URL = 'https://usewaypoint.app/privacy';
const CONFIRM_EMAIL_REDIRECT = 'waypoint:///confirm-email';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/signin');
  };

  async function handleSubmit() {
    if (loading) return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Enter your email address to continue.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('That email address doesn’t look right. Double-check and try again.');
      return;
    }
    if (password.length < 6) {
      setError('Your password needs to be at least 6 characters.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          // Deep link the verification email back into the app so
          // /confirm-email can exchange the PKCE code for a session.
          emailRedirectTo: CONFIRM_EMAIL_REDIRECT,
        },
      });

      if (signUpError) {
        const code = (signUpError as { code?: string }).code;
        if (code === 'user_already_exists') {
          setError('An account with that email already exists. Try signing in instead.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      // Email confirmation disabled in Supabase project — AuthProvider's
      // onAuthStateChange listener will pick up the new session and the
      // navigation gate will route us into onboarding. Don't navigate here.
      if (data.session) {
        return;
      }

      // Email confirmation required — show the check-your-email screen.
      router.replace({
        pathname: '/(auth)/check-email',
        params: { email: trimmedEmail },
      });
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong creating your account. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen>
      <AuthHeader onBack={handleBack} />

      <Text style={styles.headline}>Create your Waypoint account.</Text>

      {error ? (
        <View style={styles.bannerWrapper}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <View style={styles.field}>
        <AuthInput
          label="Email address"
          value={email}
          onChangeText={setEmail}
          type="email"
          autoFocus
          returnKeyType="next"
          editable={!loading}
        />
      </View>

      <View style={styles.field}>
        <AuthInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          type="password"
          hint="At least 6 characters"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!loading}
        />
      </View>

      <View style={styles.cta}>
        <PrimaryButton label="Create account" onPress={handleSubmit} loading={loading} />
      </View>

      <View style={styles.spacer} />

      <Text style={styles.disclaimer}>
        By creating an account you agree to our{' '}
        <Text
          style={styles.disclaimerLink}
          onPress={() => {
            if (loading) return;
            void Linking.openURL(TERMS_URL);
          }}
          accessibilityRole="link"
          accessibilityLabel="Terms of Use">
          Terms of Use
        </Text>{' '}
        and{' '}
        <Text
          style={styles.disclaimerLink}
          onPress={() => {
            if (loading) return;
            void Linking.openURL(PRIVACY_URL);
          }}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy">
          Privacy Policy
        </Text>
        .
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.3,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    marginBottom: authSpace.xl,
  },
  bannerWrapper: {
    marginBottom: authSpace.lg,
  },
  field: {
    marginBottom: authSpace.lg,
  },
  cta: {
    marginTop: authSpace.sm,
  },
  spacer: {
    flex: 1,
    minHeight: authSpace.xl,
  },
  disclaimer: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: authColors.textDisclaimer,
    textAlign: 'left',
    marginTop: authSpace.xl,
  },
  disclaimerLink: {
    color: '#000000',
    textDecorationLine: 'underline',
  },
});
