// components/InitialsAvatar.tsx
//
// Deterministic, network-free avatar fallback. Replaces the i.pravatar.cc /
// via.placeholder.com fallbacks (random strangers' faces / third-party hosts
// that are already returning errors in prod). Color is derived from a stable
// seed (user id) so a given user always gets the same tile.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#5C7CFA', '#FFA94D',
  '#9775FA', '#20C997', '#F06595', '#3BC9DB',
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initialsFor(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function InitialsAvatar({
  name,
  id,
  size = 48,
  style,
}: {
  name?: string | null;
  /** Stable seed for the background colour (e.g. the user id). Falls back to name. */
  id?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const backgroundColor = useMemo(() => colorFor(id || name || '?'), [id, name]);
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]} numberOfLines={1}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { color: '#FFFFFF', fontWeight: '800' },
});
