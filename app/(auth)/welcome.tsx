// app/(auth)/welcome.tsx
import React from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      {/* Using ImageBackground as placeholder for video */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800' }}
        style={{ flex: 1 }}
        blurRadius={1}>
        
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.7)']}
          style={{ flex: 1 }}>
          
          <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
            {/* Top Section with Logo */}
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 15,
                  backgroundColor: '#87CEEB',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Text style={{ fontSize: 24 }}>🌍</Text>
                </View>
                <Text style={{
                  fontSize: 32,
                  fontWeight: 'bold',
                  color: 'white',
                }}>
                  ThirdSpace
                </Text>
              </View>
            </View>

            {/* Bottom Section */}
            <View style={{ paddingHorizontal: 30, paddingBottom: 40 }}>
              <Text style={{
                fontSize: 48,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: 16,
                lineHeight: 52,
              }}>
                welcome to thirdspace
              </Text>
              
              <Text style={{
                fontSize: 20,
                color: 'white',
                marginBottom: 40,
                opacity: 0.9,
              }}>
                explore. connect. make friends.
              </Text>

              <Pressable
                onPress={() => router.push('/signin')}
                style={{
                  backgroundColor: '#4A90E2',
                  paddingVertical: 18,
                  borderRadius: 30,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}>
                <Text style={{
                  color: 'white',
                  fontSize: 18,
                  fontWeight: '600',
                }}>
                  Get Started
                </Text>
                <Text style={{ fontSize: 20 }}>🎉</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}