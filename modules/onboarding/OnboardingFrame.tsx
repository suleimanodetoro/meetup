// modules/onboarding/OnboardingFrame.tsx
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';

import PrimaryButton from '~/components/auth/PrimaryButton';
import { authColors, authHitSlop, authSpace, authType } from '~/utils/authTheme';
import { display } from '~/utils/fonts';
import { triggerLightHaptic } from '~/utils/haptics';

export interface OnboardingFrameProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  onSignOut?: () => void;
  onContinue?: () => void;
  /** When `onContinue` is set: gates the Continue button. */
  canContinue?: boolean;
  /** When true: Continue/Skip render as disabled, Continue shows a spinner. */
  busy?: boolean;
  /** Continue label override. Defaults to "Continue". */
  continueLabel?: string;
  /**
   * When true, the body content is rendered without a wrapping ScrollView.
   * Use for steps with their own scrollable content (e.g. wheel pickers) or
   * full-bleed layouts that don't want vertical scroll.
   */
  noScroll?: boolean;
  /**
   * Hide the title block (useful for bodies that render their own large
   * input under no header, like the giant-text name field).
   */
  hideHeader?: boolean;
  /** Body of the step. */
  children: ReactNode;
  /** Changes when a new step is rendered, so shared content can animate in. */
  animationKey?: string;
}

/**
 * Shared chrome for every onboarding step. Matches the Waypoint auth design
 * language: white background, chevron back top-left, optional Skip top-right,
 * bold left-aligned headline, optional subtitle, body slot, sticky black pill
 * CTA at the bottom.
 *
 * Step bodies render their own layout inside the body slot; the frame owns
 * safe area, keyboard avoidance, header, headline, and the bottom CTA.
 */
export function OnboardingFrame({
  title,
  subtitle,
  onBack,
  onSkip,
  onSignOut,
  onContinue,
  canContinue = true,
  busy = false,
  continueLabel = 'Continue',
  noScroll = false,
  hideHeader = false,
  children,
  animationKey,
}: OnboardingFrameProps) {
  const continueDisabled = busy || !canContinue;
  const handleBackPress = onBack
    ? () => {
        triggerLightHaptic();
        onBack();
      }
    : undefined;
  const handleSkipPress = onSkip
    ? () => {
        triggerLightHaptic();
        onSkip();
      }
    : undefined;
  const handleSignOutPress = onSignOut
    ? () => {
        triggerLightHaptic();
        onSignOut();
      }
    : undefined;
  const handleContinuePress = onContinue
    ? () => {
        triggerLightHaptic();
        onContinue();
      }
    : undefined;

  const header = (
    <View style={styles.headerRow}>
      {onBack ? (
        <Pressable
          onPress={handleBackPress}
          hitSlop={authHitSlop}
          disabled={busy}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={28} color={authColors.textPrimary} />
        </Pressable>
      ) : (
        <View style={styles.backButton} />
      )}
      {onSkip ? (
        <Pressable
          onPress={handleSkipPress}
          hitSlop={authHitSlop}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          style={[styles.skipButton, busy ? styles.skipDisabled : null]}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      ) : onSignOut ? (
        <Pressable
          onPress={handleSignOutPress}
          hitSlop={authHitSlop}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={[styles.skipButton, busy ? styles.skipDisabled : null]}>
          <Text style={styles.skipText}>Sign out</Text>
        </Pressable>
      ) : (
        <View style={styles.skipButton} />
      )}
    </View>
  );

  const titleBlock = hideHeader ? null : (
    <View style={styles.titleBlock}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  const animatedContent = (
    <Animated.View
      key={animationKey}
      entering={FadeInUp.duration(220).springify().damping(18)}
      exiting={FadeOut.duration(120)}
      style={noScroll ? styles.flex : undefined}>
      {titleBlock}
      {children}
    </Animated.View>
  );

  const body = noScroll ? (
    <View style={styles.bodyStatic}>{animatedContent}</View>
  ) : (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {animatedContent}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.headerPad}>{header}</View>

        {body}

        {onContinue ? (
          <View style={styles.ctaWrap}>
            <PrimaryButton
              label={continueLabel}
              onPress={handleContinuePress}
              loading={busy}
              disabled={continueDisabled && !busy}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  flex: {
    flex: 1,
  },
  headerPad: {
    paddingHorizontal: authSpace.xl,
  },
  headerRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: authSpace.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  skipButton: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: authSpace.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipPressed: {
    opacity: 0.5,
  },
  skipDisabled: {
    opacity: 0.4,
  },
  skipText: {
    fontSize: authType.link.fontSize,
    fontWeight: authType.link.fontWeight,
    color: authColors.textSecondary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: authSpace.xl,
    paddingBottom: authSpace.xl,
  },
  bodyStatic: {
    flex: 1,
    paddingHorizontal: authSpace.xl,
    paddingBottom: authSpace.xl,
  },
  titleBlock: {
    marginTop: authSpace.md,
    marginBottom: authSpace.xl,
  },
  title: {
    fontFamily: display('700'),
    fontSize: authType.headline.fontSize,
    lineHeight: authType.headline.lineHeight,
    letterSpacing: authType.headline.letterSpacing,
    fontWeight: authType.headline.fontWeight,
    color: authColors.textPrimary,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    fontWeight: authType.body.fontWeight,
    color: authColors.textSecondary,
    marginTop: authSpace.sm,
  },
  ctaWrap: {
    paddingHorizontal: authSpace.xl,
    paddingTop: authSpace.md,
    paddingBottom: authSpace.lg,
  },
});
