// modules/onboarding/fields/GenderField.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';
import type { StepBodyProps } from '../types';

type GenderId = 'male' | 'female' | 'non-binary' | 'other' | 'prefer-not-to-say';

const PRIMARY: { id: GenderId; label: string }[] = [
  { id: 'male', label: 'Man' },
  { id: 'female', label: 'Woman' },
];

const MORE: { id: GenderId; label: string }[] = [
  { id: 'non-binary', label: 'Non-binary' },
  { id: 'other', label: 'Other' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say' },
];

/**
 * Plenty-of-Fish-inspired gender selector: two primary pill chips visible
 * by default with a "+ More options" link that reveals the remaining
 * choices. Selected pill fills with a soft surface tone and a heavy black
 * border so it reads as the active choice without a brand-color dependency.
 */
export function GenderField({ value, setValue }: StepBodyProps<string>) {
  const initialExpanded = MORE.some((m) => m.id === value);
  const [expanded, setExpanded] = useState(initialExpanded);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Gender</Text>

      <View style={styles.row}>
        {PRIMARY.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            selected={value === opt.id}
            onPress={() => setValue(opt.id)}
          />
        ))}
      </View>

      {expanded ? (
        <View style={[styles.row, styles.rowExtra]}>
          {MORE.map((opt) => (
            <Chip
              key={opt.id}
              label={opt.label}
              selected={value === opt.id}
              onPress={() => setValue(opt.id)}
            />
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="More gender options"
          style={({ pressed }) => [styles.moreLink, pressed && styles.morePressed]}
        >
          <Text style={styles.moreText}>+ More options</Text>
        </Pressable>
      )}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: authSpace.sm,
  },
  sectionLabel: {
    fontSize: authType.label.fontSize,
    fontWeight: '700',
    color: authColors.textPrimary,
    marginBottom: authSpace.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpace.md,
  },
  rowExtra: {
    marginTop: authSpace.md,
  },
  chip: {
    paddingVertical: authSpace.md,
    paddingHorizontal: authSpace.xl,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    backgroundColor: authColors.bg,
    minWidth: 110,
    alignItems: 'center',
  },
  chipSelected: {
    borderColor: authColors.ctaBorder,
    borderWidth: 2,
    backgroundColor: '#F5F5F5',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '500',
    color: authColors.textTertiary,
  },
  chipTextSelected: {
    color: authColors.textPrimary,
    fontWeight: '700',
  },
  moreLink: {
    marginTop: authSpace.md,
    alignSelf: 'flex-start',
    paddingVertical: authSpace.sm,
  },
  morePressed: {
    opacity: 0.5,
  },
  moreText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textPrimary,
  },
});
