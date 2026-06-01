import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authColors, authSpace } from '~/utils/authTheme';

const CONFETTI = [
  {
    left: '7%',
    top: 18,
    width: 34,
    height: 7,
    color: authColors.accent,
    rotate: '-10deg',
    driftY: 26,
    driftX: 12,
  },
  {
    left: '18%',
    top: 76,
    width: 12,
    height: 12,
    color: authColors.textPrimary,
    rotate: '0deg',
    driftY: -18,
    driftX: -10,
  },
  {
    left: '30%',
    top: 42,
    width: 40,
    height: 8,
    color: authColors.accentBorder,
    rotate: '-24deg',
    driftY: 24,
    driftX: -16,
  },
  {
    left: '48%',
    top: 84,
    width: 14,
    height: 14,
    color: authColors.accentBorder,
    rotate: '0deg',
    driftY: -24,
    driftX: 14,
  },
  {
    left: '64%',
    top: 28,
    width: 42,
    height: 8,
    color: authColors.accent,
    rotate: '28deg',
    driftY: 22,
    driftX: 18,
  },
  {
    left: '79%',
    top: 92,
    width: 14,
    height: 14,
    color: authColors.textPrimary,
    rotate: '0deg',
    driftY: -22,
    driftX: -14,
  },
  {
    left: '86%',
    top: 46,
    width: 30,
    height: 7,
    color: authColors.accentBorder,
    rotate: '18deg',
    driftY: 28,
    driftX: 12,
  },
] as const;

export async function requestWaypointReview() {
  try {
    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;
    await StoreReview.requestReview();
  } catch (err) {
    console.warn('Store review request failed:', err);
  }
}

export function TakeABowBody() {
  const pulse = useRef(new Animated.Value(0)).current;
  const confetti = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1050,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const confettiAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(confetti, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(confetti, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    confettiAnimation.start();
    return () => {
      pulseAnimation.stop();
      confettiAnimation.stop();
    };
  }, [confetti, pulse]);

  const largeRingStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 0.05],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.78, 1.36],
        }),
      },
    ],
  };

  const smallRingStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.12],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.72, 1.18],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.confettiLayer} accessibilityIgnoresInvertColors>
          {CONFETTI.map((piece, index) => (
            <Animated.View
              key={`${piece.color}-${index}`}
              style={[
                styles.confettiPiece,
                {
                  left: piece.left,
                  top: piece.top,
                  width: piece.width,
                  height: piece.height,
                  backgroundColor: piece.color,
                  opacity: confetti.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.72, 1, 0.72],
                  }),
                  transform: [
                    {
                      translateX: confetti.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, piece.driftX],
                      }),
                    },
                    {
                      translateY: confetti.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, piece.driftY],
                      }),
                    },
                    { rotate: piece.rotate },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <Animated.View style={[styles.orbitLarge, largeRingStyle]} />
        <Animated.View style={[styles.orbitSmall, smallRingStyle]} />
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={42} color={authColors.ctaPrimaryText} />
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>You are ready</Text>
        <Text style={styles.body}>
          Your profile is set. Waypoint can now show people, plans, and trips around your current
          city.
        </Text>
      </View>
    </View>
  );
}

export function RatingBody() {
  return (
    <View style={styles.ratingContainer}>
      <View style={styles.ratingHero}>
        <View style={styles.starRow}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Ionicons key={index} name="star" size={28} color={authColors.accent} />
          ))}
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Rate Waypoint</Text>
        <Text style={styles.body}>
          If Waypoint feels useful, a quick App Store rating helps more people find plans and meet
          nearby.
        </Text>
      </View>

      <View style={styles.reviewNotes}>
        <View style={styles.noteRow}>
          <Ionicons name="shield-checkmark" size={18} color={authColors.accent} />
          <Text style={styles.noteText}>Uses the native App Store review prompt.</Text>
        </View>
        <View style={styles.noteRow}>
          <Ionicons name="time" size={18} color={authColors.accent} />
          <Text style={styles.noteText}>Takes a few seconds and never leaves the app.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: authSpace.xl,
  },
  hero: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiPiece: {
    position: 'absolute',
    borderRadius: 99,
  },
  orbitLarge: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: authColors.accentBorder,
  },
  orbitSmall: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1,
    borderColor: authColors.accentSoft,
  },
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: authColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  copy: {
    alignItems: 'flex-start',
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -0.6,
    fontWeight: '900',
    marginBottom: authSpace.md,
  },
  body: {
    color: authColors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  ratingContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingBottom: authSpace.xl,
  },
  ratingHero: {
    minHeight: 160,
    borderRadius: 28,
    backgroundColor: authColors.accentSoft,
    borderWidth: 1,
    borderColor: authColors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewNotes: {
    gap: authSpace.md,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteText: {
    flex: 1,
    marginLeft: authSpace.sm,
    color: authColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
});
