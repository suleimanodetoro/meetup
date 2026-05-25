import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PremiumBadgeProps {
  size?: number;
  style?: object;
}

/**
 * Small gold badge for premium subscribers, designed to overlay on the
 * bottom-right corner of an avatar.
 *
 * Positioning is the caller's responsibility — pass `style` to set
 * `position: 'absolute'` plus `bottom` / `right` offsets that suit the
 * particular avatar size you're decorating. This keeps the component itself
 * layout-agnostic so the same badge works on a 64px home rail thumb and on a
 * 120px profile-header avatar.
 */
export const PremiumBadge: React.FC<PremiumBadgeProps> = ({ size = 16, style }) => {
  const containerSize = size + 6;
  return (
    <View
      style={[
        styles.container,
        { width: containerSize, height: containerSize, borderRadius: containerSize / 2 },
        style,
      ]}
    >
      <Ionicons name="star" size={size - 4} color="#FFFFFF" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5B500',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
