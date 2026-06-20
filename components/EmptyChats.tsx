// components/EmptyChats.tsx
// Empty / loading state for the Chats tab: pulsing skeleton rows that preview
// what conversations look like, plus an invite CTA so a brand-new user has an
// obvious next step (go do cool sidequests with people).
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Share } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
    <View style={styles.skelSection}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} pulse={pulse} />
      ))}
    </View>
  );
}

/** Empty state: invite CTA + a skeleton preview of future conversations. */
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
        Invite friends to do cool sidequests together — your conversations show up here.
      </Text>

      <Pressable style={styles.cta} onPress={invite} accessibilityRole="button">
        <Ionicons name="person-add" size={18} color={authColors.ctaPrimaryText} />
        <Text style={styles.ctaText}>Invite friends</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/search-users')} hitSlop={8} style={styles.secondary}>
        <Text style={styles.secondaryText}>or find people nearby</Text>
      </Pressable>

      <View style={styles.skelSection}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} pulse={pulse} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingTop: authSpace.xxl,
    paddingHorizontal: authSpace.xl,
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
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpace.sm,
    alignSelf: 'center',
    backgroundColor: authColors.ctaPrimaryBg,
    paddingHorizontal: authSpace.xl,
    paddingVertical: 14,
    borderRadius: 30,
  },
  ctaText: {
    color: authColors.ctaPrimaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  secondary: {
    alignSelf: 'center',
    marginTop: authSpace.md,
  },
  secondaryText: {
    color: authColors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  skelSection: {
    marginTop: authSpace.xxl,
  },
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
