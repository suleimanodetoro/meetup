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

import { authColors, authRadius, authSpace, authType } from '../../utils/authTheme';

type OAuthProvider = 'apple' | 'google' | 'email';

interface OAuthButtonProps {
  provider: OAuthProvider;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'apple') {
    return <Ionicons name="logo-apple" size={22} color={authColors.textPrimary} />;
  }
  if (provider === 'google') {
    return <Ionicons name="logo-google" size={22} color={authColors.googleBlue} />;
  }
  return <Ionicons name="mail-outline" size={22} color={authColors.textPrimary} />;
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
      style={styles.pressable}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.button,
            isInactive && styles.disabled,
            pressed && !isInactive && styles.pressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={authColors.ctaSecondaryText} />
          ) : (
            <>
              <View style={styles.iconAbs} pointerEvents="none">
                <ProviderIcon provider={provider} />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  button: {
    width: '100%',
    minHeight: 60,
    backgroundColor: authColors.ctaSecondaryBg,
    borderRadius: authRadius.pill,
    borderWidth: 1.5,
    borderColor: authColors.ctaBorder,
    paddingVertical: 18,
    paddingHorizontal: authSpace.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    // iOS won't show <View> borders alone when wrapped in Pressable for some
    // style combinations; the shadow guarantees the pill is visually
    // distinguishable from the white background even if the border doesn't
    // paint. Android uses elevation.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  iconAbs: {
    position: 'absolute',
    left: authSpace.xl,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  label: {
    color: authColors.ctaSecondaryText,
    fontSize: authType.button.fontSize,
    fontWeight: authType.button.fontWeight,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
