// components/auth/OAuthButton.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { authColors, authRadius, authType } from '../../utils/authTheme';

type OAuthProvider = 'apple' | 'google' | 'email';

interface OAuthButtonProps {
  provider: OAuthProvider;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

// Icon slot width — used for both the icon wrapper AND the empty right spacer,
// so the centered label is not visually shifted by the icon on the left.
const ICON_SLOT = 24;

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'apple') {
    return <Ionicons name="logo-apple" size={20} color={authColors.textPrimary} />;
  }
  if (provider === 'google') {
    return <Ionicons name="logo-google" size={20} color={authColors.googleBlue} />;
  }
  return <Ionicons name="mail-outline" size={20} color={authColors.textPrimary} />;
}

export default function OAuthButton({
  provider,
  label,
  onPress,
  loading = false,
  disabled = false,
}: OAuthButtonProps) {
  const isInactive = loading || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        isInactive && styles.disabled,
        pressed && !isInactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={authColors.ctaSecondaryText} />
      ) : (
        <>
          <View style={styles.iconSlot}>
            <ProviderIcon provider={provider} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.iconSlot} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: authColors.ctaSecondaryBg,
    borderRadius: authRadius.pill,
    borderWidth: 2,
    borderColor: authColors.ctaBorder,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  iconSlot: {
    width: ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: authColors.ctaSecondaryText,
    fontSize: authType.button.fontSize,
    fontWeight: authType.button.fontWeight,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
