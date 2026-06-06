import { Pressable, StyleSheet, Text, View } from 'react-native';
import { authColors, authSpace, authType } from '~/utils/authTheme';
import { triggerLightHaptic } from '~/utils/haptics';

export interface RadioCardOption<Id extends string> {
  id: Id;
  label: string;
  description?: string;
}

interface RadioCardListProps<Id extends string> {
  options: readonly RadioCardOption<Id>[];
  value: Id | undefined;
  setValue: (next: Id) => void;
}

/**
 * Shared radio-style card list used by the gender, meeting-preference, and
 * gender-preference onboarding steps. Cards intentionally stay text-first:
 * the radio dot is the only affordance, matching the short-list onboarding
 * references and avoiding decorative emoji noise.
 */
export function RadioCardList<Id extends string>({
  options,
  value,
  setValue,
}: RadioCardListProps<Id>) {
  return (
    <View style={styles.list}>
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              triggerLightHaptic();
              setValue(opt.id);
            }}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected }}
            style={styles.pressable}>
            <View style={[styles.card, selected ? styles.cardSelected : null]}>
              <View style={styles.copy}>
                <Text style={styles.label}>{opt.label}</Text>
                {opt.description ? <Text style={styles.description}>{opt.description}</Text> : null}
              </View>
              <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: authSpace.md,
  },
  pressable: {
    width: '100%',
  },
  card: {
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderMuted,
    paddingHorizontal: 18,
    paddingVertical: authSpace.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  cardSelected: {
    borderColor: authColors.accent,
  },
  copy: {
    flex: 1,
    paddingRight: authSpace.md,
  },
  label: {
    color: authColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  description: {
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    marginTop: 4,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: authColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: authColors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: authColors.accent,
  },
});
