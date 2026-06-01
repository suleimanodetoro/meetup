import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';
import type { StepBodyProps } from '../types';

const MAX_LENGTH = 300;

export function BioField({ value, setValue }: StepBodyProps<string>) {
  const bio = value ?? '';

  return (
    <View>
      <View style={[styles.inputCard, bio.length > 0 ? styles.inputCardActive : null]}>
        <TextInput
          value={bio}
          onChangeText={setValue}
          placeholder="Share a bit about yourself..."
          placeholderTextColor={authColors.placeholder}
          multiline
          maxLength={MAX_LENGTH}
          style={styles.input}
        />
        <Text style={[styles.counter, bio.length > MAX_LENGTH * 0.9 ? styles.counterWarn : null]}>
          {bio.length}/{MAX_LENGTH}
        </Text>
      </View>

      <View style={styles.tipsCard}>
        <Tip text="Share what makes you easy to plan with." />
        <Tip text="Mention the places, activities, or weekends you enjoy." />
        <Tip text="Keep it specific enough for someone to start a conversation." />
      </View>
    </View>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <Ionicons name="checkmark-circle" size={17} color={authColors.accent} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    backgroundColor: authColors.surface,
    borderRadius: authRadius.input,
    padding: authSpace.lg,
    minHeight: 200,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    marginBottom: authSpace.lg,
  },
  inputCardActive: {
    borderColor: authColors.accent,
  },
  input: {
    fontSize: authType.body.fontSize,
    lineHeight: 24,
    color: authColors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 160,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: authSpace.sm,
    fontSize: authType.disclaimer.fontSize,
    color: authColors.textTertiary,
  },
  counterWarn: {
    color: authColors.error,
  },
  tipsCard: {
    gap: authSpace.sm,
    padding: authSpace.lg,
    borderRadius: 18,
    backgroundColor: authColors.accentSoft,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    marginLeft: authSpace.sm,
    color: authColors.textPrimary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    fontWeight: '600',
  },
});
