// app/(auth)/signin.tsx
import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '~/utils/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    });
    
    if (error) {
      Alert.alert('Error', error.message);
    }
    // Don't navigate - let the NavigationController handle it
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password 
    });
    
    if (error) {
      Alert.alert('Error', error.message);
    }
    // Don't navigate - let the NavigationController handle it
    setLoading(false);
  }

  const mockSocialSignIn = () => {
    Alert.alert(
      'Social Sign In',
      'Social auth would go here. For now, use email auth below.',
      [{ text: 'OK', onPress: () => setShowEmailAuth(true) }]
    );
  };

  return (
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB', '#90CAF9']}
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          
          {/* Decorative Elements */}
          <View style={{ position: 'absolute', top: 100, left: 30 }}>
            <Text style={{ fontSize: 60 }}>✈️</Text>
          </View>
          <View style={{ position: 'absolute', top: 150, right: 40 }}>
            <Text style={{ fontSize: 50 }}>🌍</Text>
          </View>
          
          {/* Cloud decorations */}
          <View style={{
            position: 'absolute',
            bottom: 100,
            left: -50,
            width: 150,
            height: 60,
            backgroundColor: 'white',
            borderRadius: 30,
            opacity: 0.3,
          }} />
          <View style={{
            position: 'absolute',
            top: 250,
            right: -30,
            width: 120,
            height: 50,
            backgroundColor: 'white',
            borderRadius: 25,
            opacity: 0.3,
          }} />

          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>
            {/* Photo Card */}
            <View style={{
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
                source={{ uri: 'https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?w=400' }}
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 17,
                }}
              />
            </View>

            <Text style={{
              fontSize: 28,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              22,345 travelers are active
            </Text>
            <Text style={{
              fontSize: 28,
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              right now!
            </Text>
            
            <Text style={{
              fontSize: 16,
              color: '#666',
              textAlign: 'center',
              marginBottom: 40,
            }}>
              Connect with fellow travelers in real-time
            </Text>

            {!showEmailAuth ? (
              <>
                {/* Social Sign In Button */}
                <Pressable
                  onPress={mockSocialSignIn}
                  style={{
                    backgroundColor: 'white',
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
                  }}>
                  <Text style={{ fontSize: 20 }}>🍎</Text>
                  <Text style={{
                    fontSize: 17,
                    fontWeight: '600',
                  }}>
                    Sign in with Apple
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowEmailAuth(true)}
                  style={{ alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: '#666', fontSize: 14 }}>
                    or use email instead
                  </Text>
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
                      <Text style={{ color: loading ? '#ccc' : '#007AFF', fontSize: 17, fontWeight: '600' }}>
                        {loading ? 'Loading...' : 'Sign Up'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {/* Terms */}
            <Text style={{
              fontSize: 12,
              color: '#666',
              textAlign: 'center',
              marginTop: 40,
              lineHeight: 18,
            }}>
              By continuing, you agree to our{' '}
              <Text style={{ color: '#007AFF' }}>terms of service</Text>
              {' '}and also certify that you've read our{' '}
              <Text style={{ color: '#007AFF' }}>privacy policy</Text>.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}