// components/EmptyChats.tsx
// Empty / loading state for the Chats tab. The skeleton preview is sandwiched
// between two CTAs: invite friends (primary, glossy gradient) above, start a
// sidequest (secondary) below — both lead to having conversations.
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Share } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientButton } from '~/components/GradientButton';
import { authColors, authSpace } from '~/utils/authTheme';
import { display } from '~/utils/fonts';

const SKELETON = '#E9EDF3';
const INVITE_MESSAGE = 'Come do sidequests with me on Waypoint 👉 https://usewaypoint.app';

// One shared opacity loop drives every skeleton block.
function usePulse() {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return pulse;
}

function SkeletonRow({ pulse }: { pulse: Animated.Value }) {
  return (
    <View style={styles.skelRow}>
      <Animated.View style={[styles.skelAvatar, { opacity: pulse }]} />
      <View style={styles.skelText}>
        <Animated.View style={[styles.skelLineWide, { opacity: pulse }]} />
        <Animated.View style={[styles.skelLineNarrow, { opacity: pulse }]} />
      </View>
    </View>
  );
}

/** Just the pulsing rows — used for the Chats loading state. */
export function ChatSkeletons({ count = 6 }: { count?: number }) {
  const pulse = usePulse();
  return (
    <View style={styles.skelSectionPlain}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} pulse={pulse} />
      ))}
    </View>
  );
}

/** Empty state: invite CTA → skeleton preview → start-a-sidequest CTA. */
export function EmptyChats() {
  const pulse = usePulse();

  const invite = () => {
    Share.share({ message: INVITE_MESSAGE }).catch(() => {});
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="chatbubbles-outline" size={30} color={authColors.accent} />
      </View>
      <Text style={styles.title}>No chats yet</Text>
      <Text style={styles.subtitle}>
        Invite friends or start a sidequest — your conversations show up here.
      </Text>

      {/* Top CTA */}
      <GradientButton icon="person-add" label="Invite friends" onPress={invite} />

      {/* Sandwiched skeleton preview */}
      <View style={styles.skelSection}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} pulse={pulse} />
        ))}
      </View>

      {/* Bottom CTA */}
      <Pressable
        style={styles.secondaryCta}
        onPress={() => router.push('/create-plan/intent' as never)}
        accessibilityRole="button">
        <Ionicons name="compass-outline" size={18} color={authColors.accent} />
        <Text style={styles.secondaryCtaText}>Start a sidequest</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: authSpace.xl,
    paddingVertical: authSpace.xl,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: authColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: authSpace.lg,
  },
  title: {
    fontFamily: display('700'),
    fontSize: 22,
    fontWeight: '700',
    color: authColors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: authColors.textSecondary,
    textAlign: 'center',
    marginTop: authSpace.sm,
    marginBottom: authSpace.xl,
    paddingHorizontal: authSpace.md,
  },
  ctaShadow: {
    alignSelf: 'stretch',
    borderRadius: 30,
    shadowColor: '#0A5CE0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpace.sm,
    paddingVertical: 16,
    borderRadius: 30,
    overflow: 'hidden',
  },
  ctaSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpace.sm,
    alignSelf: 'stretch',
    paddingVertical: 15,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: authColors.accentBorder,
    backgroundColor: authColors.accentSoft,
  },
  secondaryCtaText: {
    color: authColors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  skelSection: {
    marginVertical: authSpace.xl,
  },
  skelSectionPlain: {},
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.lg,
    paddingVertical: authSpace.md,
  },
  skelAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: SKELETON,
  },
  skelText: {
    flex: 1,
    gap: 8,
  },
  skelLineWide: {
    height: 12,
    borderRadius: 6,
    backgroundColor: SKELETON,
    width: '70%',
  },
  skelLineNarrow: {
    height: 12,
    borderRadius: 6,
    backgroundColor: SKELETON,
    width: '40%',
  },
});
