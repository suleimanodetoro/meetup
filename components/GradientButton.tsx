// components/GradientButton.tsx
// The standard "refraction" CTA used for EVERY color-filled button in the app:
// a diagonal brand gradient + a top white sheen (the glassy/refractive look) +
// a colored drop shadow. Drop-in for primary actions (Continue, Create, Save,
// Join, Send, Invite, …). Outlined / ghost / secondary buttons keep their look.
import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Gradient override [top-left, bottom-right]; defaults to brand blue. */
  colors?: [string, string];
  /** Outer container overrides — margins, width, alignment. */
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'md' | 'lg';
}

const BRAND: [string, string] = ['#3D9BFF', '#0A5CE0'];
const DISABLED: [string, string] = ['#C8D7E8', '#C8D7E8'];

export function GradientButton({
  label,
  onPress,
  icon,
  disabled,
  loading,
  colors,
  style,
  textStyle,
  size = 'lg',
}: GradientButtonProps) {
  const inactive = !!disabled || !!loading;
  const grad = inactive ? DISABLED : (colors ?? BRAND);

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      style={[styles.shadow, inactive && styles.noShadow, style]}>
      <LinearGradient
        colors={grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btn, size === 'md' && styles.btnMd]}>
        {/* Top sheen — the refractive highlight. */}
        {!inactive && (
          <LinearGradient
            colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sheen}
            pointerEvents="none"
          />
        )}
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
            <Text style={[styles.label, textStyle]}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignSelf: 'stretch',
    borderRadius: 30,
    shadowColor: '#0A5CE0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  noShadow: { shadowOpacity: 0, elevation: 0 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 30,
    overflow: 'hidden',
  },
  btnMd: { paddingVertical: 12 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  label: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
