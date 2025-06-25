import { Stack } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TextInput,
  Pressable,
  View,
  Text,
} from 'react-native';
import { supabase } from '~/utils/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert(error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert(error.message);
    else if (!session) Alert.alert('✓ Check your inbox for verification');
    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Welcome' }} />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        className="flex-1 justify-center px-6"
      >
        <View className="bg-white rounded-2xl shadow-lg p-6">
          {/* — Inputs with explicit bottom margin on the first for spacing — */}
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base mb-4"
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {/* — Buttons side-by-side, with one outlined & one filled in your red brand — */}
          <View className="flex-row mt-8">
            <Pressable
              onPress={signInWithEmail}
              disabled={loading}
              className="flex-1 items-center rounded-lg border-2 border-red-500 py-3 mr-3"
            >
              <Text className="text-base font-semibold text-red-500">Sign In</Text>
            </Pressable>
            <Pressable
              onPress={signUpWithEmail}
              disabled={loading}
              className="flex-1 items-center rounded-lg bg-red-500 py-3"
            >
              <Text className="text-base font-semibold text-white">Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
