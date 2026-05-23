// app/create-plan/about.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '~/contexts/CreatePlanContext';

export default function AboutActivityScreen() {
  const { formData, updateField, nextStep, canContinue, setStep } = useCreatePlan();
  const [localDescription, setLocalDescription] = useState(formData.description);
  const isValid = localDescription.trim().length >= 30;

  useEffect(() => {
    updateField('description', localDescription);
  }, [localDescription]);
  useEffect(() => {
    setStep(3);
  }, [setStep]);

  const handleContinue = () => {
    if (canContinue()) {
      nextStep();
      router.push('/create-plan/date');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </Pressable>
          <Text style={styles.headerTitle}>Create Plan</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress */}
        <StepperProgress currentStep={3} totalSteps={9} />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>About Activity</Text>
            <Text style={styles.subtitle}>A short description about your activity</Text>

            {/* Hints */}
            <View style={styles.hints}>
              <Text style={styles.hintTitle}>Include:</Text>
              <Text style={styles.hintItem}>• What we'll do and for how long</Text>
              <Text style={styles.hintItem}>• Where we'll meet</Text>
              <Text style={styles.hintItem}>• What to bring / any limits</Text>
            </View>

            <TextInput
              value={localDescription}
              onChangeText={setLocalDescription}
              placeholder="Type something..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              style={styles.input}
            />

            <View style={styles.counter}>
              <Text style={[styles.counterText, !isValid && styles.counterError]}>
                {localDescription.length} characters (minimum 30)
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleContinue}
            disabled={!isValid}
            style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}>
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>
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
  scrollView: {
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
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  hints: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  hintItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  counter: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  counterText: {
    fontSize: 14,
    color: '#999',
  },
  counterError: {
    color: '#FF6B6B',
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
