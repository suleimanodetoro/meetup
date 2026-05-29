// components/auth/PrimaryButton.tsx
import React, { useState } from 'react';
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

/**
 * Why the inner-View pattern:
 * `babel-preset-expo` is configured with `jsxImportSource: 'nativewind'`, which
 * routes every JSX element through NativeWind's runtime. Function-form
 * `style={({pressed}) => [...]}` on `Pressable` interacts poorly with that
 * runtime in some setups — the merged style ends up stripped, leaving the
 * Pressable with no backgroundColor/borderColor/text-color and rendering as
 * an invisible tappable rectangle. By putting visual styles on a plain inner
 * `View` and using only a static layout style on the Pressable, NativeWind's
 * runtime can't interfere with the visuals.
 *
 * `accessibilityIgnoresInvertColors` opts the rendered surface out of iOS
 * Smart Invert, so the black pill stays black even when an accessibility
 * color filter is enabled.
 */
export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  leftIcon,
}: PrimaryButtonProps) {
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
          <ActivityIndicator color={authColors.ctaPrimaryText} />
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
