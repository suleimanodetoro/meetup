// app/(auth)/signin.tsx
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AuthHeader from '~/components/auth/AuthHeader';
import AuthInput from '~/components/auth/AuthInput';
import AuthScreen from '~/components/auth/AuthScreen';
import PrimaryButton from '~/components/auth/PrimaryButton';
import SecondaryButton from '~/components/auth/SecondaryButton';
import ErrorBanner from '~/components/ErrorBanner';
import { authColors, authSpace } from '~/utils/authTheme';
import { supabase } from '~/utils/supabase';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const passwordRef = useRef<{ focus: () => void } | null>(null);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleEmailChange = (next: string) => {
    setEmail(next);
    if (error) setError(null);
  };

  const handlePasswordChange = (next: string) => {
    setPassword(next);
    if (error) setError(null);
  };

  const focusPassword = () => {
    passwordRef.current?.focus?.();
  };

  async function signIn() {
    if (loading) return;

    const trimmedEmail = email.trim();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (!isMounted.current) return;

      if (signInError) {
        const code = (signInError as any).code as string | undefined;
        if (code === 'invalid_credentials') {
          setError('Email or password is incorrect.');
        } else if (code === 'email_not_confirmed') {
          setError('Please confirm your email before signing in.');
        } else {
          setError(signInError.message || 'Something went wrong. Please try again.');
        }
      }
      // On success, AuthProvider handles routing.
    } catch (err: any) {
      if (!isMounted.current) return;
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }

  return (
    <AuthScreen>
      <AuthHeader />

      <Text style={styles.headline}>Welcome back.</Text>

      <View style={styles.fields}>
        <AuthInput
          label="Email address"
          type="email"
          value={email}
          onChangeText={handleEmailChange}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={focusPassword}
          editable={!loading}
        />

        <View style={styles.passwordWrapper}>
          <AuthInputWithRef
            ref={passwordRef}
            label="Password"
            type="password"
            value={password}
            onChangeText={handlePasswordChange}
            returnKeyType="go"
            onSubmitEditing={signIn}
            editable={!loading}
          />
        </View>

        <Pressable
          onPress={() => router.push('/forgot-password')}
          hitSlop={8}
          style={styles.forgotWrapper}
          accessibilityRole="link"
          accessibilityLabel="Forgot password?"
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorWrapper}>
          <ErrorBanner message={error} />
        </View>
      ) : null}

      <View style={styles.primaryWrapper}>
        <PrimaryButton label="Sign in" onPress={signIn} loading={loading} />
      </View>

      <View style={styles.secondaryWrapper}>
        <SecondaryButton
          label="Sign up"
          onPress={() => router.push('/signup')}
          disabled={loading}
        />
      </View>
    </AuthScreen>
  );
}

// AuthInput owns its TextInput and doesn't expose a ref. To support
// focusing the password field from the email field's "next" return key
// without modifying the shared component, we bump a focus token that
// remounts AuthInput with autoFocus=true. The parent owns the value, so
// nothing typed is lost.
const AuthInputWithRef = React.forwardRef<
  { focus: () => void },
  React.ComponentProps<typeof AuthInput>
>((props, ref) => {
  const [focusToken, setFocusToken] = useState(0);
  React.useImperativeHandle(ref, () => ({
    focus: () => setFocusToken((n) => n + 1),
  }));
  return <AuthInput key={focusToken} autoFocus={focusToken > 0} {...props} />;
});
AuthInputWithRef.displayName = 'AuthInputWithRef';

const styles = StyleSheet.create({
  headline: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    color: authColors.textPrimary,
    textAlign: 'left',
    marginBottom: authSpace.xxl,
  },
  fields: {
    gap: authSpace.lg,
  },
  passwordWrapper: {
    width: '100%',
  },
  forgotWrapper: {
    alignSelf: 'flex-start',
    marginTop: authSpace.lg,
  },
  forgotText: {
    fontSize: 15,
    fontWeight: '500',
    color: authColors.textPrimary,
    textDecorationLine: 'underline',
  },
  errorWrapper: {
    marginTop: authSpace.lg,
  },
  primaryWrapper: {
    marginTop: authSpace.xl,
  },
  secondaryWrapper: {
    marginTop: authSpace.md,
  },
});
