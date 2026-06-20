// components/CreatePlanHeader.tsx
// Shared header for the create-plan / sidequest-creation flow: a back chevron,
// the screen title, and an always-present X that cancels the whole flow (with a
// confirm), resets the draft, and drops the user back into the app — so you can
// bail out from any step, not just by tapping back N times.
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCreatePlan } from '~/contexts/CreatePlanContext';

interface CreatePlanHeaderProps {
  title?: string;
  /** Override the back action (defaults to router.back()). */
  onBack?: () => void;
}

export default function CreatePlanHeader({ title = 'Create Plan', onBack }: CreatePlanHeaderProps) {
  const { resetForm } = useCreatePlan();

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else router.back();
  }, [onBack]);

  const handleCancel = useCallback(() => {
    Alert.alert('Discard sidequest?', "You'll lose what you've entered so far.", [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          resetForm();
          // Pop the whole pushed create-plan stack back to the app; fall back
          // to a hard replace if there's nothing to dismiss.
          if (router.canDismiss()) router.dismissAll();
          else router.replace('/(tabs)');
        },
      },
    ]);
  }, [resetForm]);

  return (
    <View style={styles.header}>
      <Pressable onPress={handleBack} style={styles.iconButton} hitSlop={8}>
        <Ionicons name="chevron-back" size={28} color="#333" />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        onPress={handleCancel}
        style={styles.iconButton}
        hitSlop={8}
        accessibilityLabel="Cancel and discard"
        accessibilityRole="button">
        <Ionicons name="close" size={26} color="#333" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconButton: {
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
