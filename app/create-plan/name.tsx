// app/create-plan/name.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  SafeAreaView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import CreatePlanHeader from '~/components/CreatePlanHeader';
import { useCreatePlan } from '~/contexts/CreatePlanContext';
import { GradientButton } from '~/components/GradientButton';

export default function PlanNameScreen() {
  const { formData, updateField, nextStep, canContinue, setStep } = useCreatePlan();
  const [localTitle, setLocalTitle] = useState(formData.title);
  const isValid = localTitle.trim().length > 0 && localTitle.length <= 60;

  useEffect(() => {
    updateField('title', localTitle);
  }, [localTitle, updateField]);

  useFocusEffect(
    useCallback(() => {
      setStep(1); // re-assert on focus so back-nav restores the right step
    }, [setStep])
  );

  const handleContinue = () => {
    if (canContinue()) {
      nextStep();
      router.push('/create-plan/image');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <CreatePlanHeader />

        {/* Progress */}
        <StepperProgress currentStep={1} totalSteps={9} />

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Plan Name</Text>
          <Text style={styles.subtitle}>Enter plan name to get started</Text>

          <TextInput
            value={localTitle}
            onChangeText={setLocalTitle}
            placeholder="Saturday Karting at Teamsport"
            placeholderTextColor="#999"
            maxLength={60}
            style={styles.input}
          />

          <View style={styles.helperRow}>
            {isValid && <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />}
            <Text style={[styles.helperText, isValid && styles.helperTextValid]}>
              No more than 60 characters
            </Text>
          </View>
        </View>

        {/* Continue Button */}
        <View style={styles.footer}>
          <GradientButton label="Continue" onPress={handleContinue} disabled={!isValid} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#999',
  },
  helperTextValid: {
    color: '#4CAF50',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#C8D7E8',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
});
