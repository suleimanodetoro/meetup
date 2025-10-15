// app/(auth)/onboarding-pause.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, SafeAreaView, Animated, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W } = Dimensions.get('window');

export default function OnboardingPauseScreen() {
  const params = useLocalSearchParams();

  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = () => {
    router.push({ pathname: '/onboarding-picture', params });
  };

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 30, justifyContent: 'space-between' }}>
          
          {/* Top Content */}
          <Animated.View 
            style={{ 
              opacity: fade,
              transform: [{ translateY: slideUp }],
              paddingTop: 60,
            }}>
            
            {/* Emoji */}
            <Text style={{ fontSize: 64, marginBottom: 24 }}>🎉</Text>
            
            {/* Title */}
            <Text style={{ 
              fontSize: 40, 
              fontWeight: 'bold', 
              marginBottom: 16,
              color: '#1a1a1a',
            }}>
              you're almost{'\n'}there!
            </Text>
            
            {/* Subtitle */}
            <Text style={{ 
              fontSize: 18, 
              color: '#666', 
              lineHeight: 26,
              marginBottom: 48,
            }}>
              Just a few more steps and you'll be ready to start making connections.
            </Text>

            {/* Progress Visual */}
            <View style={{ 
              backgroundColor: 'white',
              borderRadius: 24,
              padding: 32,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}>
              
              {/* Stats Grid */}
              <View style={{ gap: 24 }}>
                
                {/* Stat 1 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 24,
                    backgroundColor: '#E3F2FD',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 24 }}>✓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
                      Profile Created
                    </Text>
                    <Text style={{ fontSize: 14, color: '#999', marginTop: 2 }}>
                      Looking good so far
                    </Text>
                  </View>
                </View>

                {/* Stat 2 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 24,
                    backgroundColor: '#E3F2FD',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 24 }}>✓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
                      Interests Selected
                    </Text>
                    <Text style={{ fontSize: 14, color: '#999', marginTop: 2 }}>
                      Finding your people
                    </Text>
                  </View>
                </View>

                {/* Stat 3 - Next step */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 24,
                    backgroundColor: '#F5F5F5',
                    borderWidth: 2,
                    borderColor: '#007AFF',
                    borderStyle: 'dashed',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 24 }}>📸</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
                      Add Your Photo
                    </Text>
                    <Text style={{ fontSize: 14, color: '#999', marginTop: 2 }}>
                      Next up
                    </Text>
                  </View>
                </View>

              </View>

              {/* Progress Bar */}
              <View style={{ 
                marginTop: 32,
                height: 8,
                backgroundColor: '#F0F0F0',
                borderRadius: 4,
                overflow: 'hidden',
              }}>
                <View style={{
                  width: '60%',
                  height: '100%',
                  backgroundColor: '#007AFF',
                  borderRadius: 4,
                }} />
              </View>
              
              <Text style={{ 
                marginTop: 12,
                fontSize: 14,
                color: '#999',
                textAlign: 'center',
              }}>
                60% complete
              </Text>

            </View>
          </Animated.View>

          {/* Bottom Buttons */}
          <View style={{ paddingBottom: 30 }}>
            <Pressable 
              onPress={handleContinue} 
              style={{
                backgroundColor: '#007AFF',
                paddingVertical: 18,
                borderRadius: 30,
                alignItems: 'center',
                marginBottom: 16,
                marginTop:16
              }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
                Continue
              </Text>
            </Pressable>
            
            <Pressable 
              onPress={() => router.back()}
              style={{ paddingVertical: 12 }}>
              <Text style={{ color: '#666', fontSize: 16, textAlign: 'center' }}>
                Go back
              </Text>
            </Pressable>
          </View>

        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}