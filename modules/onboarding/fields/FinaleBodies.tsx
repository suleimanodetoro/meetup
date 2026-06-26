import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { authColors, authSpace, authType } from '~/utils/authTheme';

// Survey "social proof" bubbles + the founder-note headshot on the rating step.
const REVIEW_AVATARS = [
  require('~/assets/onboarding/review_avatar_1.png'),
  require('~/assets/onboarding/review_avatar_2.png'),
  require('~/assets/onboarding/review_avatar_3.png'),
];
const FOUNDER_AVATAR = require('~/assets/onboarding/founder.png');

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
        <Text style={styles.ratingTitle}>Enjoying the app?</Text>
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
        <Text style={styles.ratingSocialTitle}>Waypoint was made for people like you</Text>
        <View style={styles.avatarStack}>
          {REVIEW_AVATARS.map((src, index) => (
            <View
              key={index}
              style={[styles.surveyAvatar, index > 0 && styles.avatarOverlap]}>
              <Image source={src} style={styles.surveyAvatarImage} resizeMode="cover" />
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
            <Image source={FOUNDER_AVATAR} style={styles.reviewerAvatarImage} resizeMode="cover" />
          </View>
          <View style={styles.reviewerTextBlock}>
            <Text style={styles.reviewerName}>S.O</Text>
            <Text style={styles.reviewerRole}>Founder note</Text>
          </View>
          <View style={styles.reviewStars}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Ionicons key={index} name="star" size={15} color={authColors.accent} />
            ))}
          </View>
        </View>
        <Text style={styles.reviewQuote}>
          Waypoint started from a simple feeling: life is better when it gives you people, not just places and things to do. I hope it helps you find the kind of moments you could never have planned.
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
        d="M9.24601 6.61105C9.03276 8.25332 10.35 9.77729 10.35 9.77729C10.35 9.77729 12.013 8.6386 12.2262 6.99633C12.4395 5.35405 11.1223 3.83008 11.1223 3.83008C11.1223 3.83008 9.45927 4.96877 9.24601 6.61105Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M7.68301 12.1301C8.37906 13.6334 10.3074 14.2234 10.3074 14.2234C10.3074 14.2234 11.1071 12.3759 10.4111 10.8726C9.71504 9.36923 7.78674 8.7793 7.78674 8.7793C7.78674 8.7793 6.98696 10.6267 7.68301 12.1301Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M8.50364 17.4151C9.83175 18.4083 11.8095 18.0136 11.8095 18.0136C11.8095 18.0136 11.634 16.0089 10.3059 15.0157C8.97775 14.0226 7 14.4172 7 14.4172C7 14.4172 7.17554 16.422 8.50364 17.4151Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M12.1131 21.7134C13.6181 22.4115 15.4716 21.6181 15.4716 21.6181C15.4716 21.6181 14.8851 19.6926 13.3801 18.9944C11.8751 18.2962 10.0216 19.0897 10.0216 19.0897C10.0216 19.0897 10.6081 21.0152 12.1131 21.7134Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M13.7813 2.96764C12.5708 4.10058 12.6174 6.11247 12.6174 6.11247C12.6174 6.11247 14.6267 6.28752 15.8372 5.15458C17.0477 4.02165 17.001 2.00975 17.001 2.00975C17.001 2.00975 14.9918 1.83471 13.7813 2.96764Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MyLaurelWreathRight({ size = 24, color = '#000000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.7555 6.61105C16.9688 8.25332 15.6516 9.77729 15.6516 9.77729C15.6516 9.77729 13.9886 8.6386 13.7753 6.99633C13.5621 5.35405 14.8793 3.83008 14.8793 3.83008C14.8793 3.83008 16.5423 4.96877 16.7555 6.61105Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M18.3173 12.1301C17.6213 13.6334 15.693 14.2234 15.693 14.2234C15.693 14.2234 14.8932 12.3759 15.5893 10.8726C16.2853 9.36923 18.2136 8.7793 18.2136 8.7793C18.2136 8.7793 19.0134 10.6267 18.3173 12.1301Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M17.4973 17.4151C16.1692 18.4083 14.1914 18.0136 14.1914 18.0136C14.1914 18.0136 14.3669 16.0089 15.6951 15.0157C17.0232 14.0226 19.0009 14.4172 19.0009 14.4172C19.0009 14.4172 18.8254 16.422 17.4973 17.4151Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M13.8878 21.7134C12.3828 22.4115 10.5293 21.6181 10.5293 21.6181C10.5293 21.6181 11.1158 19.6926 12.6208 18.9944C14.1258 18.2962 15.9793 19.0897 15.9793 19.0897C15.9793 19.0897 15.3927 21.0152 13.8878 21.7134Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M12.22 2.96764C13.4305 4.10058 13.3838 6.11247 13.3838 6.11247C13.3838 6.11247 11.3746 6.28752 10.1641 5.15458C8.95358 4.02165 9.00024 2.00975 9.00024 2.00975C9.00024 2.00975 11.0095 1.83471 12.22 2.96764Z"
        stroke={color}
        strokeWidth={1.5}
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
    overflow: 'hidden',
  },
  avatarOverlap: {
    marginLeft: -13,
  },
  surveyAvatarImage: {
    width: '100%',
    height: '100%',
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
    overflow: 'hidden',
  },
  reviewerAvatarImage: {
    width: '100%',
    height: '100%',
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
