// components/PulseChip.tsx
// Pulse Monitor state chip: 🔥 Hot / ✨ Warm / 🌙 Cooling. Renders nothing for
// cold or unknown states — cold is the default state of strangers, so showing
// it would be noise (see docs/specs/01-pulse-monitor.md).
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

const PULSE_STATES: Record<string, { emoji: string; label: string; fg: string; bg: string; border: string }> =
  {
    hot: { emoji: '🔥', label: 'Hot', fg: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
    warm: { emoji: '✨', label: 'Warm', fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
    cooling: { emoji: '🌙', label: 'Cooling', fg: '#4338CA', bg: '#EEF2FF', border: '#C7D2FE' },
  };

interface PulseChipProps {
  state?: string | null;
  style?: ViewStyle;
}

export function PulseChip({ state, style }: PulseChipProps) {
  const cfg = state ? PULSE_STATES[state] : undefined;
  if (!cfg) return null;

  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg, borderColor: cfg.border }, style]}>
      <Text style={styles.emoji}>{cfg.emoji}</Text>
      <Text style={[styles.label, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  emoji: {
    fontSize: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
