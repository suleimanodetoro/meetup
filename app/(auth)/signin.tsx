// app/(auth)/signin.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Image,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    // Configure Google Sign In
    GoogleSignin.configure({
      iosClientId: '545991292691-7qfgijc8l5j7de4no0ukkd4mdurcmni8.apps.googleusercontent.com',
      webClientId: '545991292691-qoos66lpbiro4jdjcl662cdpnosqonp5.apps.googleusercontent.com',
    });

    return () => {
      isMounted.current = false;
    };
  }, []);

  async function signInWithEmail() {
    if (!isMounted.current) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error && isMounted.current) {
      Alert.alert('Error', error.message);
    }
    if (isMounted.current) {
      setLoading(false);
    }
  }

  async function signUpWithEmail() {
    if (!isMounted.current) return;
    const trimmed = email.trim();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        // Deep link the verification email back into the app. The
        // confirm-email screen exchanges the PKCE code for a session and
        // then hands off to NavigationController.
        emailRedirectTo: 'waypoint://confirm-email',
      },
    });

    if (!isMounted.current) return;
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // When email confirmation is enabled in the Supabase project, signUp
    // returns a user row but no session — we route to the "check your
    // email" screen so the user knows to look in their inbox. When
    // confirmation is disabled, a session comes back immediately and
    // NavigationController will route them to onboarding.
    if (!data.session) {
      router.replace({
        pathname: '/check-email',
        params: { email: trimmed },
      });
    }
  }

  async function signInWithApple() {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'Apple Sign In is only available on iOS devices.');
      return;
    }

    if (!isMounted.current) return;

    try {
      setLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!isMounted.current) return;

      // Sign in with Supabase using the identity token
      const { data: authData, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (error) {
        throw error;
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

        // Save the name to user metadata for future use
        await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            given_name: credential.fullName.givenName,
            family_name: credential.fullName.familyName,
          },
        });
      }
    } catch (error: any) {
      // Handle cancellation - user dismissed the dialog
      const errorCode = error?.code || error?.type || '';

      if (
        errorCode === 'ERR_REQUEST_CANCELED' ||
        errorCode === 'ERR_CANCELED' ||
        errorCode === 1001 || // Apple's cancellation code
        error?.message?.includes('cancel')
      ) {
        // User canceled - normal, return silently.
        return;
      }

      // Log the actual error for debugging
      console.error('Apple Sign In error:', error);

      // Only show alert if component is still mounted
      if (isMounted.current) {
        const errorMessage = error?.message || error?.toString() || 'Failed to sign in with Apple';
        Alert.alert('Error', errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }

  async function signInWithGoogle() {
    if (!isMounted.current) return;

    try {
      setLoading(true);

      // Check if device supports Google Play services (Android)
      await GoogleSignin.hasPlayServices();

      // Trigger Google Sign In
      const response = await GoogleSignin.signIn();

      // Check if sign in was cancelled
      if (response.type === 'cancelled') {
        return;
      }

      if (!isMounted.current) return;

      // Get the ID token from the response data
      const { idToken } = response.data;

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      // Sign in with Supabase using the ID token
      const { data: authData, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        throw error;
      }

      if (!isMounted.current) return;

      // Save user profile data if available
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

    } catch (error: any) {
      // Handle different error types
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }

      if (error.code === statusCodes.IN_PROGRESS) {
        return;
      }

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available or outdated');
        return;
      }

      // Log the actual error
      console.error('Google Sign In error:', error);

      // Only show alert if component is still mounted
      if (isMounted.current) {
        const errorMessage = error?.message || error?.toString() || 'Failed to sign in with Google';
        Alert.alert('Error', errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Decorative Elements */}
          <View style={{ position: 'absolute', top: 100, left: 30 }}>
            <Text style={{ fontSize: 60 }}>🎡</Text>
          </View>
          <View style={{ position: 'absolute', top: 150, right: 40 }}>
            <Text style={{ fontSize: 50 }}>🥳</Text>
          </View>

          {/* Subtle decorative shapes */}
          <View
            style={{
              position: 'absolute',
              bottom: 100,
              left: -50,
              width: 150,
              height: 60,
              backgroundColor: 'white',
              borderRadius: 30,
              opacity: 0.2,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 250,
              right: -30,
              width: 120,
              height: 50,
              backgroundColor: 'white',
              borderRadius: 25,
              opacity: 0.2,
            }}
          />

          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>
            {/* Photo Card */}
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 20,
                padding: 3,
                marginBottom: 40,
                alignSelf: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
                elevation: 10,
              }}>
              <Image
                source={{
                  uri: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=400',
                }}
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 17,
                }}
              />
            </View>

            <Text
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 16,
              }}>
              Your next adventure is waiting
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: '#666',
                textAlign: 'center',
                marginBottom: 40,
              }}>
              Connect with people around the world
            </Text>

            {!showEmailAuth ? (
              <>
                {/* Apple Sign In Button - iOS Only */}
                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={signInWithApple}
                    disabled={loading}
                    style={{
                      backgroundColor: loading ? '#ccc' : 'black',
                      paddingVertical: 16,
                      borderRadius: 30,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 12,
                      marginBottom: 20,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 3,
                    }}>
                    <Ionicons name="logo-apple" size={24} color={loading ? '#999' : 'white'} />
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '600',
                        color: loading ? '#999' : 'white',
                      }}>
                      {loading ? 'Signing in...' : 'Sign in with Apple'}
                    </Text>
                  </Pressable>
                )}

                {/* Google Sign In Button */}
                <Pressable
                  onPress={signInWithGoogle}
                  disabled={loading}
                  style={{
                    backgroundColor: loading ? '#ccc' : 'white',
                    paddingVertical: 16,
                    borderRadius: 30,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 12,
                    marginBottom: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                    borderWidth: 1,
                    borderColor: loading ? '#ccc' : '#dadce0',
                  }}>
                  <Ionicons name="logo-google" size={24} color={loading ? '#999' : '#4285F4'} />
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '600',
                      color: loading ? '#999' : '#3c4043',
                    }}>
                    {loading ? 'Signing in...' : 'Sign in with Google'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowEmailAuth(true)}
                  style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: '#666', fontSize: 14 }}>or use email instead</Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* Email Auth Form */}
                <View style={{ gap: 16 }}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                      backgroundColor: 'white',
                      padding: 16,
                      borderRadius: 12,
                      fontSize: 16,
                    }}
                  />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                    autoCapitalize="none"
                    style={{
                      backgroundColor: 'white',
                      padding: 16,
                      borderRadius: 12,
                      fontSize: 16,
                    }}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable
                      onPress={signInWithEmail}
                      disabled={loading}
                      style={{
                        flex: 1,
                        backgroundColor: loading ? '#ccc' : '#007AFF',
                        paddingVertical: 16,
                        borderRadius: 30,
                        alignItems: 'center',
                      }}>
                      <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>
                        {loading ? 'Loading...' : 'Sign In'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={signUpWithEmail}
                      disabled={loading}
                      style={{
                        flex: 1,
                        backgroundColor: 'white',
                        paddingVertical: 16,
                        borderRadius: 30,
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: loading ? '#ccc' : '#007AFF',
                      }}>
                      <Text
                        style={{
                          color: loading ? '#ccc' : '#007AFF',
                          fontSize: 17,
                          fontWeight: '600',
                        }}>
                        {loading ? 'Loading...' : 'Sign Up'}
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => router.push('/forgot-password')}
                    style={{ alignItems: 'center', marginTop: 4 }}
                    hitSlop={8}>
                    <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '500' }}>
                      Forgot password?
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* Terms */}
            <Text
              style={{
                fontSize: 12,
                color: '#666',
                textAlign: 'center',
                marginTop: 40,
                lineHeight: 18,
              }}>
              By continuing, you agree to our{' '}
              <Text
                style={{ color: '#007AFF' }}
                onPress={() => Linking.openURL('https://usewaypoint.app/terms')}>
                terms of service
              </Text>{' '}
              and also certify that you've read our{' '}
              <Text
                style={{ color: '#007AFF' }}
                onPress={() => Linking.openURL('https://usewaypoint.app/privacy')}>
                privacy policy
              </Text>
              .
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
