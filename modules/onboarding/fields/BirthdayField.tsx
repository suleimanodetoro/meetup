// modules/onboarding/fields/BirthdayField.tsx
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DatePicker from 'react-native-date-picker';

import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';
import { formatCalendarDate, parseCalendarDate } from '~/utils/calendarDate';
import type { StepBodyProps } from '../types';

const DEFAULT_DATE = new Date(1998, 0, 1);
const MIN_DATE = new Date(1920, 0, 1);

/**
 * Swarm-inspired birthday picker. Renders the picked date inside a pill-
 * outline input above an inline wheel-spinner DatePicker. The age
 * confirmation modal is owned by the step's `commit` (see steps.ts) so
 * that "Continue" → "Are you X years old?" → advance is one fluid action.
 */
export function BirthdayField({ value, setValue }: StepBodyProps<string>) {
  const today = useMemo(() => new Date(), []);

  const date = value ? parseCalendarDate(value) : DEFAULT_DATE;

  // Seed the slot with the default date so the user can tap Continue right
  // away (matches Swarm's pre-filled wheel UX). We do this in an effect to
  // avoid a setState-during-render warning.
  useEffect(() => {
    if (!value) {
      setValue(formatCalendarDate(DEFAULT_DATE));
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
          onDateChange={(d) => setValue(formatCalendarDate(d))}
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
