// components/auth/SecondaryButton.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { authColors, authRadius, authSpace, authType } from '../../utils/authTheme';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
}

// Inner-View pattern — see PrimaryButton.tsx for the why. Function-form
// `style={({pressed}) => [...]}` on Pressable is stripped by NativeWind's
// runtime, which leaves the border/bg invisible.
export default function SecondaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  leftIcon,
}: SecondaryButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isInactive = loading || disabled;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={styles.pressable}
    >
      <View
        accessibilityIgnoresInvertColors
        style={[
          styles.button,
          isInactive ? styles.disabled : null,
          pressed && !isInactive ? styles.pressed : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={authColors.ctaSecondaryText} />
        ) : (
          <View style={styles.row}>
            {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
            <Text style={styles.label}>{label}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  button: {
    backgroundColor: authColors.ctaSecondaryBg,
    borderRadius: authRadius.pill,
    borderWidth: 1.5,
    borderColor: authColors.ctaBorder,
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
