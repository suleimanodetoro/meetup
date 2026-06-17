// app/(auth)/welcome.tsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { AppImage } from '~/components/AppImage';

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import AuthScreen from '~/components/auth/AuthScreen';
import OAuthButton from '~/components/auth/OAuthButton';
import ErrorBanner from '~/components/ErrorBanner';
import { supabase } from '~/utils/supabase';
import { authColors, authSpace, authType } from '~/utils/authTheme';

type PendingProvider = 'apple' | 'google' | 'email' | null;

const TERMS_URL = 'https://usewaypoint.app/terms';
const PRIVACY_URL = 'https://usewaypoint.app/privacy';

export default function WelcomeScreen() {
  const [pending, setPending] = useState<PendingProvider>(null);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    GoogleSignin.configure({
      iosClientId: '545991292691-7qfgijc8l5j7de4no0ukkd4mdurcmni8.apps.googleusercontent.com',
      webClientId: '545991292691-qoos66lpbiro4jdjcl662cdpnosqonp5.apps.googleusercontent.com',
    });

    return () => {
      isMounted.current = false;
    };
  }, []);

  async function signInWithApple() {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not available', 'Apple sign-in is unavailable on this device.');
      return;
    }

    if (!isMounted.current) return;

    setError(null);
    setPending('apple');

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!isMounted.current) return;

      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (authError) {
        throw authError;
      }

      if (!isMounted.current) return;

      // Apple only provides the user's name on the first sign-in
      if (credential.fullName) {
        const fullName = [
          credential.fullName.givenName,
          credential.fullName.middleName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(' ');

        await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: credential.fullName.givenName,
            family_name: credential.fullName.familyName,
          },
        });
      }
    } catch (err: any) {
      const errorCode = err?.code || err?.type || '';

      // User cancellation is silent
      if (
        errorCode === 'ERR_REQUEST_CANCELED' ||
        errorCode === 'ERR_CANCELED' ||
        errorCode === 1001 ||
        err?.message?.includes('cancel')
      ) {
        return;
      }

      console.error('Apple Sign In error:', err);

      if (isMounted.current) {
        setError(err?.message || 'Failed to sign in with Apple. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setPending(null);
      }
    }
  }

  async function signInWithGoogle() {
    if (!isMounted.current) return;

    setError(null);
    setPending('google');

    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      // User cancellation is silent
      if (response.type === 'cancelled') {
        return;
      }

      if (!isMounted.current) return;

      const { idToken } = response.data;

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (authError) {
        throw authError;
      }

      if (!isMounted.current) return;

      if (response.data.user) {
        const { name, givenName, familyName, photo } = response.data.user;

        await supabase.auth.updateUser({
          data: {
            full_name: name || '',
            given_name: givenName || '',
            family_name: familyName || '',
            avatar_url: photo || '',
          },
        });
      }
    } catch (err: any) {
      // User cancellation is silent
      if (err?.code === statusCodes.SIGN_IN_CANCELLED || err?.code === statusCodes.IN_PROGRESS) {
        return;
      }

      if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Not available', 'Google Play Services are unavailable on this device.');
        return;
      }

      console.error('Google Sign In error:', err);

      if (isMounted.current) {
        setError(err?.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setPending(null);
      }
    }
  }

  function continueWithEmail() {
    setError(null);
    router.push('/signin');
  }

  const isBusy = pending !== null;
  const showAppleButton = Platform.OS === 'ios';

  return (
    <AuthScreen scrollable={false}>
      {/* Top-down layout. No space-between, no flex:1 stretch on children.
          The buttons land in the middle-lower part of the screen with
          intentional whitespace below them, matching the Tripadvisor inspo. */}
      <View style={styles.container}>
        <View
          style={styles.brandRow}
          accessibilityRole="header"
          accessibilityLabel="Waypoint"
        >
          <View style={styles.logoTile}>
            <AppImage
              source={require('~/assets/ios-light.png')}
              style={styles.logoImage}
              contentFit="cover"
              transition={0}
              accessibilityIgnoresInvertColors
            />
          </View>
          <Text style={styles.wordmark}>Waypoint</Text>
        </View>

        <Text style={styles.headline} accessibilityRole="header">
          Find your people in every city you visit.
        </Text>

        <Text style={styles.disclaimer}>
          By proceeding, you agree to our{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => Linking.openURL(TERMS_URL)}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use"
          >
            Terms of Use
          </Text>
          {' '}and confirm you have read our{' '}
          <Text
            style={styles.disclaimerLink}
            onPress={() => Linking.openURL(PRIVACY_URL)}
            accessibilityRole="link"
            accessibilityLabel="Privacy and Cookie Statement"
          >
            Privacy and Cookie Statement
          </Text>
          .
        </Text>

        {/* Push the buttons down into the lower half of the screen. */}
        <View style={styles.spacer} />

        {error ? (
          <View style={styles.errorWrap}>
            <ErrorBanner message={error} />
          </View>
        ) : null}

        <View style={styles.buttonStack}>
          {showAppleButton && (
            <OAuthButton
              provider="apple"
              label="Continue with Apple"
              onPress={signInWithApple}
              loading={pending === 'apple'}
              disabled={isBusy && pending !== 'apple'}
            />
          )}
          <OAuthButton
            provider="google"
            label="Continue with Google"
            onPress={signInWithGoogle}
            loading={pending === 'google'}
            disabled={isBusy && pending !== 'google'}
          />
          <OAuthButton
            provider="email"
            label="Continue with email"
            onPress={continueWithEmail}
            disabled={isBusy}
          />
        </View>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Intentionally NO justifyContent — content stacks from the top.
    // Whitespace below the buttons is the empty remainder of the column.
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.md,
    marginTop: authSpace.lg,
    marginBottom: authSpace.xxxl,
  },
  logoTile: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#87CEEB',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '700',
    color: authColors.textPrimary,
  },
  headline: {
    fontSize: authType.headline.fontSize,
    lineHeight: authType.headline.lineHeight,
    letterSpacing: authType.headline.letterSpacing,
    fontWeight: authType.headline.fontWeight,
    color: authColors.textPrimary,
    textAlign: 'left',
    marginBottom: authSpace.lg,
  },
  disclaimer: {
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    fontWeight: authType.disclaimer.fontWeight,
    color: authColors.textDisclaimer,
    marginBottom: authSpace.xxl,
  },
  disclaimerLink: {
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    fontWeight: authType.disclaimer.fontWeight,
    color: authColors.textPrimary,
    textDecorationLine: 'underline',
  },
  errorWrap: {
    marginBottom: authSpace.md,
  },
  buttonStack: {
    gap: authSpace.md,
    width: '100%',
    marginBottom: authSpace.xl,
  },
  spacer: {
    flex: 1,
  },
});
