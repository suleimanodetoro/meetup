import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { authColors, authSpace, authType } from '~/utils/authTheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COLORS = [
  authColors.accent,
  authColors.textPrimary,
  authColors.accentBorder,
  '#7FB8FF',
  '#FFD166',
  '#EF476F',
] as const;

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 999) * 10000;
  return value - Math.floor(value);
}

const CONFETTI = Array.from({ length: 86 }, (_, index) => {
  const cannonX = index % 2 === 0 ? SCREEN_WIDTH * 0.34 : SCREEN_WIDTH * 0.66;
  const endX = -40 + pseudoRandom(index + 1) * (SCREEN_WIDTH + 80);
  const burstY = 44 + pseudoRandom(index + 17) * 130;
  const fallY = SCREEN_HEIGHT + 70 + pseudoRandom(index + 29) * 180;
  const width = 8 + pseudoRandom(index + 41) * 22;
  const height = 6 + pseudoRandom(index + 53) * 7;

  return {
    id: index,
    startX: cannonX,
    startY: 112 + pseudoRandom(index + 7) * 18,
    burstX: endX * 0.72 + cannonX * 0.28,
    burstY,
    endX,
    fallY,
    width,
    height,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    delay: (index % 18) * 0.018,
    rotate: 180 + pseudoRandom(index + 67) * 720,
  };
});

export async function requestWaypointReview() {
  try {
    const configuredUrl =
      Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_APP_STORE_URL
        : process.env.EXPO_PUBLIC_PLAY_STORE_URL;

    if (!configuredUrl) return;

    const reviewUrl =
      Platform.OS === 'ios' && !configuredUrl.includes('action=write-review')
        ? `${configuredUrl}${configuredUrl.includes('?') ? '&' : '?'}action=write-review`
        : configuredUrl;

    if (await Linking.canOpenURL(reviewUrl)) {
      await Linking.openURL(reviewUrl);
    }
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
          duration: 1350,
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

    const confettiAnimation = Animated.sequence([
      Animated.timing(confetti, {
        toValue: 1,
        duration: 4200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(500),
      Animated.timing(confetti, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]);

    const loopingConfetti = Animated.loop(
      Animated.sequence([confettiAnimation, Animated.delay(700)])
    );

    pulseAnimation.start();
    loopingConfetti.start();
    return () => {
      pulseAnimation.stop();
      loopingConfetti.stop();
    };
  }, [confetti, pulse]);

  const largeRingStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.72, 2.45],
        }),
      },
    ],
  };

  const smallRingStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.58, 1.82],
        }),
      },
    ],
  };

  const outerRingStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.45, 0.28, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 3.05],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.confettiLayer} pointerEvents="none" accessibilityIgnoresInvertColors>
        {CONFETTI.map((piece) => {
          const start = piece.delay;
          const burst = Math.min(start + 0.18, 0.82);
          const finish = 1;

          return (
            <Animated.View
              key={piece.id}
              style={[
                styles.confettiPiece,
                {
                  width: piece.width,
                  height: piece.height,
                  backgroundColor: piece.color,
                  opacity: confetti.interpolate({
                    inputRange: [0, start, burst, 0.94, finish],
                    outputRange: [0, 0, 1, 1, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      translateX: confetti.interpolate({
                        inputRange: [0, start, burst, finish],
                        outputRange: [piece.startX, piece.startX, piece.burstX, piece.endX],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      translateY: confetti.interpolate({
                        inputRange: [0, start, burst, finish],
                        outputRange: [piece.startY, piece.startY, piece.burstY, piece.fallY],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      rotate: confetti.interpolate({
                        inputRange: [0, finish],
                        outputRange: ['0deg', `${piece.rotate}deg`],
                      }),
                    },
                  ],
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.hero}>
        <Animated.View style={[styles.orbitOuter, outerRingStyle]} />
        <Animated.View style={[styles.orbitLarge, largeRingStyle]} />
        <Animated.View style={[styles.orbitSmall, smallRingStyle]} />
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={42} color={authColors.ctaPrimaryText} />
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>You are all set!</Text>
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
      <View style={styles.ratingTop}>
        <Text style={styles.ratingTitle}>ENJOYING THE APP?</Text>
      </View>

      <View style={styles.ratingScoreCard}>
        <MyLaurelWreathLeft size={52} color={authColors.accent} />
        <View style={styles.ratingScoreContent}>
          <View style={styles.ratingScoreRow}>
            <Text style={styles.ratingScore}>4.8</Text>
            <View style={styles.ratingStars}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Ionicons key={index} name="star" size={20} color={authColors.accent} />
              ))}
            </View>
          </View>
          <Text style={styles.ratingScoreLabel}>Most common rating from early Waypoint survey</Text>
        </View>
        <MyLaurelWreathRight size={52} color={authColors.accent} />
      </View>

      <View style={styles.ratingSocialProof}>
        <Text style={styles.ratingSocialTitle}>Waypoint was made for travelers like you</Text>
        <View style={styles.avatarStack}>
          {['S', 'W', 'O'].map((initial, index) => (
            <View
              key={`${initial}-${index}`}
              style={[styles.surveyAvatar, index > 0 && styles.avatarOverlap]}>
              <Text style={styles.surveyAvatarText}>{initial}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.ratingSocialCaption}>
          Early testers are already shaping the community
        </Text>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewerAvatar}>
            <Text style={styles.reviewerAvatarText}>S</Text>
          </View>
          <View style={styles.reviewerTextBlock}>
            <Text style={styles.reviewerName}>Suleiman O</Text>
            <Text style={styles.reviewerRole}>Founder note</Text>
          </View>
          <View style={styles.reviewStars}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Ionicons key={index} name="star" size={15} color={authColors.accent} />
            ))}
          </View>
        </View>
        <Text style={styles.reviewQuote}>
          Waypoint is for people who want travel to feel social before they even land.
        </Text>
      </View>

      <View />
    </View>
  );
}

function MyLaurelWreathLeft({ size = 24, color = '#000000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3C9.5 5 8 8 8 12C8 16 9.5 19 12 21M9 5C6.5 7 5.5 10 5.5 13C5.5 15.5 6 17.5 7.5 19M6 8C4 10 3.5 12 3.5 14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MyLaurelWreathRight({ size = 24, color = '#000000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3C14.5 5 16 8 16 12C16 16 14.5 19 12 21M15 5C17.5 7 18.5 10 18.5 13C18.5 15.5 18 17.5 16.5 19M18 8C20 10 20.5 12 20.5 14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: authSpace.xl,
    overflow: 'hidden',
  },
  hero: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  confettiPiece: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 3,
  },
  orbitOuter: {
    position: 'absolute',
    width: 238,
    height: 238,
    borderRadius: 119,
    borderWidth: 3,
    borderColor: authColors.accent,
    backgroundColor: authColors.accentSoft,
  },
  orbitLarge: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 4,
    borderColor: authColors.accent,
    backgroundColor: authColors.accentSoft,
  },
  orbitSmall: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 4,
    borderColor: authColors.accent,
    backgroundColor: authColors.accentSoft,
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
    zIndex: 2,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -0.6,
    fontWeight: '500',
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
    paddingTop: authSpace.xl,
    paddingBottom: authSpace.lg,
    justifyContent: 'space-between',
    gap: authSpace.xl,
  },
  ratingTop: {
    gap: authSpace.sm,
  },
  ratingTitle: {
    color: authColors.textPrimary,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.7,
    fontWeight: '900',
  },
  ratingScoreCard: {
    minHeight: 110,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    backgroundColor: authColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: authSpace.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  ratingScoreContent: {
    flex: 1,
    alignItems: 'center',
  },
  ratingScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.sm,
  },
  ratingScore: {
    color: authColors.textPrimary,
    fontSize: 23,
    fontWeight: '900',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingScoreLabel: {
    marginTop: authSpace.xs,
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    fontWeight: '700',
    textAlign: 'center',
  },
  ratingSocialProof: {
    alignItems: 'center',
    gap: authSpace.md,
  },
  ratingSocialTitle: {
    color: authColors.textPrimary,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.45,
    fontWeight: '900',
    textAlign: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  surveyAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: authColors.surface,
    backgroundColor: authColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlap: {
    marginLeft: -13,
  },
  surveyAvatarText: {
    color: authColors.accent,
    fontSize: 22,
    fontWeight: '900',
  },
  ratingSocialCaption: {
    color: authColors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  reviewCard: {
    borderRadius: 24,
    backgroundColor: authColors.surfaceAlt,
    borderWidth: 1,
    borderColor: authColors.accentBorder,
    padding: authSpace.lg,
    shadowColor: authColors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: authSpace.md,
  },
  reviewerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: authColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: authSpace.md,
  },
  reviewerAvatarText: {
    color: authColors.ctaPrimaryText,
    fontSize: 17,
    fontWeight: '900',
  },
  reviewerTextBlock: {
    flex: 1,
  },
  reviewerName: {
    color: authColors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  reviewerRole: {
    color: authColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewQuote: {
    color: authColors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
});
