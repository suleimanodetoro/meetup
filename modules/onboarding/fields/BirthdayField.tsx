// modules/onboarding/fields/BirthdayField.tsx
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DatePicker from 'react-native-date-picker';

import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';
import type { StepBodyProps } from '../types';

const DEFAULT_DATE = new Date(1998, 0, 1);
const MIN_DATE = new Date(1920, 0, 1);

export function calculateAge(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age;
}

/**
 * Swarm-inspired birthday picker. Renders the picked date inside a pill-
 * outline input above an inline wheel-spinner DatePicker. The age
 * confirmation modal is owned by the step's `commit` (see sequence.ts) so
 * that "Continue" → "Are you X years old?" → advance is one fluid action.
 */
export function BirthdayField({ value, setValue }: StepBodyProps<string>) {
  const today = useMemo(() => new Date(), []);

  const date = value ? new Date(value) : DEFAULT_DATE;

  // Seed the slot with the default date so the user can tap Continue right
  // away (matches Swarm's pre-filled wheel UX). We do this in an effect to
  // avoid a setState-during-render warning.
  useEffect(() => {
    if (!value) {
      setValue(DEFAULT_DATE.toISOString().split('T')[0]);
    }
    // Intentionally only seeding once on mount; the wheel handles subsequent
    // updates via onDateChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatted = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Birthday</Text>

      <View style={styles.field}>
        <Text style={styles.fieldText}>{formatted}</Text>
      </View>

      <View style={styles.pickerWrap}>
        <DatePicker
          date={date}
          mode="date"
          maximumDate={today}
          minimumDate={MIN_DATE}
          onDateChange={(d) => setValue(d.toISOString().split('T')[0])}
          theme="light"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  label: {
    fontSize: authType.label.fontSize,
    fontWeight: authType.label.fontWeight,
    color: authColors.textSecondary,
    marginBottom: authSpace.sm,
  },
  field: {
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    borderRadius: authRadius.input,
    paddingVertical: authSpace.lg,
    paddingHorizontal: authSpace.lg,
    minHeight: 56,
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 17,
    fontWeight: '500',
    color: authColors.textPrimary,
  },
  pickerWrap: {
    marginTop: authSpace.lg,
    alignItems: 'center',
  },
});
