// app/(auth)/onboarding-pause.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, SafeAreaView, Animated, StyleSheet, Dimensions, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Rect, Defs, LinearGradient as SvgLG, Stop } from 'react-native-svg';

const { width: W } = Dimensions.get('window');
const H = 300; // graphic height

export default function OnboardingPauseScreen() {
  const params = useLocalSearchParams();

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = () => {
    router.push({ pathname: '/onboarding-picture', params });
  };

  // Curve points (smaller y = higher). Gentle rise.
  const y1 = H * 0.72;   // start low
  const y2 = H * 0.50;   // mid higher
  const y3 = H * 0.34;   // end highest

  // Bars (kept below the line)
  const barW = 88;
  const leftBarX  = W * 0.20 - barW / 2, leftBarH  = H * 0.38;
  const rightBarX = W * 0.68 - barW / 2, rightBarH = H * 0.60;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 6 }}>
          <Text style={{ fontSize: 48, marginBottom: 6 }}>🎉</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', marginBottom: 8 }}>
            you're almost{'\n'}there!
          </Text>
          <Text style={{ fontSize: 16, color: '#555', lineHeight: 22 }}>
We’re finding more groups, activities, and fun in your Thirdspace.</Text>

          {/* Full-width graphic */}
          <Animated.View style={{ opacity: fade, transform: [{ scale: pop }] }}>
            <View style={styles.card}>
              <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                <Defs>
                  <SvgLG id="bg" x1="0" y1={H} x2={W} y2="0">
                    <Stop offset="0" stopColor="#DBFFF4" />
                    <Stop offset="1" stopColor="#D6ECFF" />
                  </SvgLG>
                </Defs>

                {/* background */}
                <Rect x="0" y="0" width={W} height={H} rx="24" fill="url(#bg)" />

                {/* bars (below the curve) */}
                <Rect x={leftBarX}  y={H - leftBarH}  width={barW} height={leftBarH}  rx="16" fill="#CFE2FF" />
                <Rect x={rightBarX} y={H - rightBarH} width={barW} height={rightBarH} rx="16" fill="#8FB8FF" />

                {/* rising curve above bars */}
                <Path
                  d={`M 0 ${y1}
                      C ${W * 0.25} ${y1 - 40}, ${W * 0.45} ${y2 + 10}, ${W * 0.55} ${y2}
                      S ${W * 0.85} ${y3 - 10}, ${W} ${y3}`}
                  fill="none"
                  stroke="#26C5B7"
                  strokeWidth={5}
                />
              </Svg>

              {/* Badges ABOVE bars – emoji or replace with images */}
              <View style={[styles.badge, { left: leftBarX + barW / 2 - 20, top: H - leftBarH - 24 }]}>
                <Text style={{ fontSize: 18 }}>😞</Text>
                {/* Or <Image source={{ uri: 'https://example.com/avatar1.png' }} style={styles.badgeImg} /> */}
              </View>

              <View style={[styles.badge, { left: rightBarX + barW / 2 - 20, top: H - rightBarH - 24 }]}>
                <Text style={{ fontSize: 18 }}>🤩</Text>
                {/* Or <Image source={{ uri: 'https://example.com/avatar2.png' }} style={styles.badgeImg} /> */}
              </View>
            </View>
          </Animated.View>
        </View>

        {/* footer */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 28, marginTop: 14 }}>
          <Pressable onPress={handleContinue} style={styles.cta}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Continue</Text>
          </Pressable>
          <Pressable style={{ paddingVertical: 12 }} onPress={() => router.back()}>
            <Text style={{ color: '#7a7a7a', fontSize: 16, textAlign: 'center' }}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: W,
    height: H,
    marginLeft: -24,
    marginRight: -24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6F0FF',
    marginTop: 16,
  },
  badge: {
    position: 'absolute',
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  badgeImg: { width: 40, height: 40, borderRadius: 20 },
  cta: { backgroundColor: '#4A90E2', paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
});
