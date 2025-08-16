// app/create-plan/guidelines.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '../contexts/CreatePlanContext';

const GUIDELINES = [
  'No illegal activity',
  'No hate speech or harassment',
  "Don't mislead on price or details",
  'Respect venue rules and staff',
  'Share accurate time and place',
  "You'll coordinate any changes",
];

export default function GuidelinesScreen() {
  const { formData, updateField, nextStep, canContinue } = useCreatePlan();
  const [checkedItems, setCheckedItems] = useState<boolean[]>(new Array(GUIDELINES.length).fill(false));
  const [acceptedGuidelines, setAcceptedGuidelines] = useState(false);

  useEffect(() => {
    updateField('guidelinesAccepted', acceptedGuidelines);
  }, [acceptedGuidelines]);

  const toggleCheck = (index: number) => {
    const newChecked = [...checkedItems];
    newChecked[index] = !newChecked[index];
    setCheckedItems(newChecked);
  };

  const handleContinue = () => {
    if (canContinue()) {
      nextStep();
      router.push('/create-plan/review');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>Create Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress */}
      <StepperProgress currentStep={8} totalSteps={9} />

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Before you create</Text>
          <Text style={styles.subtitle}>Keep this safe for everyone</Text>

          {/* Guidelines List */}
          <View style={styles.guidelinesContainer}>
            {GUIDELINES.map((guideline, index) => (
              <Pressable
                key={index}
                onPress={() => toggleCheck(index)}
                style={styles.guidelineRow}
              >
                <View style={[
                  styles.checkbox,
                  checkedItems[index] && styles.checkboxChecked,
                ]}>
                  {checkedItems[index] && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={styles.guidelineText}>{guideline}</Text>
              </Pressable>
            ))}
          </View>

          {/* Main Acceptance */}
          <Pressable
            onPress={() => setAcceptedGuidelines(!acceptedGuidelines)}
            style={styles.acceptanceContainer}
          >
            <View style={[
              styles.checkbox,
              acceptedGuidelines && styles.checkboxChecked,
            ]}>
              {acceptedGuidelines && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
            <Text style={styles.acceptanceText}>
              I understand and will follow these guidelines
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!acceptedGuidelines}
          style={[
            styles.continueButton,
            !acceptedGuidelines && styles.continueButtonDisabled,
          ]}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
  scrollView: {
    flex: 1,
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
    marginBottom: 32,
  },
  guidelinesContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  guidelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  guidelineText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  acceptanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  acceptanceText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 34,
  },
  continueButton: {
    backgroundColor: '#4A90E2',
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