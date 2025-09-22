// app/components/StepperProgress.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface StepperProgressProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepperProgress({ currentStep, totalSteps }: StepperProgressProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps - 1 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.step,
            index + 1 <= currentStep && styles.stepActive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  step: {
    flex: 1,
    height: 3,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  stepActive: {
    backgroundColor: '#007AFF',
  },
});