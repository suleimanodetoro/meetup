import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authColors, authSpace, authType } from '~/utils/authTheme';

/**
 * Interstitial step body — no field, no input. The Frame renders it inside
 * the standard chrome with Continue at the bottom. The step's `commit` is
 * a no-op; `isValid` is always true.
 */
export function PauseBody() {
  const fade = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fade, slideUp]);

  return (
    <Animated.View style={[styles.wrap, { opacity: fade, transform: [{ translateY: slideUp }] }]}>
      <View style={styles.heroIcon}>
        <Ionicons name="sparkles" size={34} color={authColors.accent} />
      </View>

      <View style={styles.card}>
        <View style={styles.rows}>
          <ProgressRow title="Profile started" subtitle="Your basics are saved" />
          <ProgressRow title="Interests selected" subtitle="Your suggestions are getting sharper" />
          <ProgressRow title="Photo is next" subtitle="People connect faster with a face" pending />
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <Text style={styles.progressText}>60% complete</Text>
      </View>
    </Animated.View>
  );
}

function ProgressRow({
  title,
  subtitle,
  pending,
}: {
  title: string;
  subtitle: string;
  pending?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, pending ? styles.rowIconPending : null]}>
        <Ionicons
          name={pending ? 'ellipse-outline' : 'checkmark'}
          size={pending ? 18 : 20}
          color={pending ? authColors.accent : authColors.ctaPrimaryText}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: authSpace.md,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: authColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: authSpace.xl,
  },
  card: {
    backgroundColor: authColors.surface,
    borderRadius: 24,
    padding: authSpace.xxl,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  rows: {
    gap: authSpace.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: authColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: authSpace.md,
  },
  rowIconPending: {
    backgroundColor: authColors.accentSoft,
    borderWidth: 1,
    borderColor: authColors.accent,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: authType.body.fontSize,
    fontWeight: '700',
    color: authColors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 14,
    color: authColors.textSecondary,
    marginTop: 2,
  },
  progressTrack: {
    marginTop: authSpace.xxl,
    height: 8,
    backgroundColor: authColors.accentSoft,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    width: '60%',
    height: '100%',
    backgroundColor: authColors.accent,
    borderRadius: 4,
  },
  progressText: {
    marginTop: authSpace.md,
    fontSize: authType.disclaimer.fontSize,
    color: authColors.textSecondary,
    textAlign: 'center',
    fontWeight: '700',
  },
});
