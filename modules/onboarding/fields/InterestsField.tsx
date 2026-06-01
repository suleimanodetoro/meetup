import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors, authSpace, authType } from '~/utils/authTheme';
import { SORTED_INTERESTS as INTERESTS, type InterestId } from '~/utils/constants';
import type { StepBodyProps } from '../types';

const MAX_INTERESTS = 5;

export function InterestsField({ value, setValue }: StepBodyProps<InterestId[]>) {
  const selected = value ?? [];

  const toggle = (id: InterestId) => {
    if (selected.includes(id)) {
      setValue(selected.filter((s) => s !== id));
      return;
    }
    if (selected.length >= MAX_INTERESTS) {
      Alert.alert('Maximum Interests', `You can select up to ${MAX_INTERESTS} interests`);
      return;
    }
    setValue([...selected, id]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.helper}>
        Pick up to {MAX_INTERESTS}. We use these to suggest people and plans.
      </Text>
      <View style={styles.grid}>
        {INTERESTS.map((i) => {
          const isSelected = selected.includes(i.id);
          return (
            <Pressable
              key={i.id}
              onPress={() => toggle(i.id)}
              style={[styles.chip, isSelected ? styles.chipSelected : null]}>
              <Text style={[styles.chipText, isSelected ? styles.chipTextSelected : null]}>
                {i.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: authSpace.xs,
  },
  helper: {
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    fontWeight: '600',
    marginBottom: authSpace.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpace.md,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    backgroundColor: authColors.surface,
    borderColor: authColors.borderSubtle,
  },
  chipSelected: {
    backgroundColor: authColors.accent,
    borderColor: authColors.accent,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: authColors.textPrimary,
  },
  chipTextSelected: {
    color: authColors.ctaPrimaryText,
  },
});
