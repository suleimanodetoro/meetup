// app/(auth)/welcome.tsx
import React from 'react';
import { View, Text, Pressable, SafeAreaView, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function WelcomeScreen() {
// Video by Taryn Elliott from Pexels: https://www.pexels.com/video/1966695/
  const source = require('../../assets/welcome-background.mp4');
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={{ flex: 1 }}>
      <VideoView
        style={StyleSheet.absoluteFillObject}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.7)']}
        style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 15,
                  backgroundColor: '#87CEEB',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden',
                }}>
                <Image
                  source={require('../../assets/ios-light.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
              <Text style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>Waypoint</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 30, paddingBottom: 40 }}>
            <Text
              style={{
                fontSize: 48,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: 16,
                lineHeight: 52,
                textTransform: 'lowercase',
              }}>
              welcome to waypoint
            </Text>
            <Text style={{ fontSize: 20, color: 'white', marginBottom: 40, opacity: 0.9 }}>
              explore. connect. make friends.
            </Text>
            <Pressable
              onPress={() => router.push('/signin')}
              style={{
                backgroundColor: '#007AFF',
                paddingVertical: 18,
                borderRadius: 30,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Get Started</Text>
              <Text style={{ fontSize: 20 }}>🎉</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
