// modules/onboarding/fields/NameField.tsx
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { authColors, authSpace } from '~/utils/authTheme';
import type { StepBodyProps } from '../types';

/**
 * Single, oversized text input that owns the screen — inspired by the
 * Peacock onboarding "What's your profile name?" pattern. No box, just
 * giant text with an underline below. A circular arrow button below the
 * input advances the flow (no frame CTA — the step sets hideCta: true).
 *
 * Deliberately NOT autofocused: an autofocus-on-mount raised the iOS
 * keyboard before the user could see the button below the input. User
 * taps the input to focus; pressing Done on the keyboard fires Continue.
 */
export function NameField({
  value,
  setValue,
  onContinue,
  canContinue,
  busy,
}: StepBodyProps<string>) {
  const [pressed, setPressed] = useState(false);
  const disabled = !canContinue || busy;

  return (
    <View style={styles.wrap}>
      <TextInput
        value={value ?? ''}
        onChangeText={(text) => setValue(text)}
        placeholder="Your name"
        placeholderTextColor={authColors.textTertiary}
        style={styles.input}
        autoCapitalize="words"
        autoComplete="name"
        autoCorrect={false}
        returnKeyType="done"
        maxLength={50}
        selectionColor={authColors.textPrimary}
        onSubmitEditing={() => {
          if (!disabled && onContinue) onContinue();
        }}
      />
      <View style={styles.underline} />

      <View style={styles.ctaRow}>
        <Pressable
          onPress={() => onContinue?.()}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled, busy }}
          style={styles.fabPressable}>
          <View
            accessibilityIgnoresInvertColors
            style={[
              styles.fab,
              disabled ? styles.fabDisabled : null,
              pressed && !disabled ? styles.fabPressed : null,
            ]}>
            {busy ? (
              <ActivityIndicator color={authColors.ctaPrimaryText} />
            ) : (
              <Ionicons name="arrow-forward" size={30} color={authColors.ctaPrimaryText} />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 64,
  },
  input: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: authColors.textPrimary,
    paddingVertical: authSpace.sm,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  underline: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: authColors.inputBorder,
    marginTop: authSpace.xs,
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: authSpace.xxl,
  },
  fabPressable: {
    // Layout-only on the Pressable. Visual styles live on the inner View so
    // NativeWind's jsxImportSource runtime can't strip the backgroundColor.
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: authColors.ctaPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  fabDisabled: {
    opacity: 0.55,
  },
  fabPressed: {
    opacity: 0.85,
  },
});
