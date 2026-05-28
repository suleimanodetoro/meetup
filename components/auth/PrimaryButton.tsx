// components/auth/PrimaryButton.tsx
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { authColors, authRadius, authSpace, authType } from '../../utils/authTheme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
}

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  leftIcon,
}: PrimaryButtonProps) {
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
        <ActivityIndicator color={authColors.ctaPrimaryText} />
      ) : (
        <View style={styles.row}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: authColors.ctaPrimaryBg,
    borderRadius: authRadius.pill,
    paddingVertical: 18,
    paddingHorizontal: authSpace.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: authSpace.sm,
  },
  label: {
    color: authColors.ctaPrimaryText,
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
