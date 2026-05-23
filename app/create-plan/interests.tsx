// app/create-plan/interests.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, SafeAreaView, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '~/contexts/CreatePlanContext';
import { SORTED_INTERESTS as INTERESTS, type InterestId } from '~/utils/constants';

export default function InterestsScreen() {
  const { formData, updateField, nextStep, canContinue, setStep } = useCreatePlan();
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>(
    formData.interests as InterestId[]
  );

  useEffect(() => {
    updateField('interests', selectedInterests);
  }, [selectedInterests, updateField]); 

  useEffect(() => {
  setStep(6);
}, [setStep]);


  const toggleInterest = (id: InterestId) => {
    if (selectedInterests.includes(id)) {
      setSelectedInterests((prev) => prev.filter((i) => i !== id));
    } else {
      if (selectedInterests.length >= 5) {
        Alert.alert('Maximum Reached', 'You can select up to 5 interests');
        return;
      }
      setSelectedInterests((prev) => [...prev, id]);
    }
  };

  const handleContinue = () => {
    if (canContinue()) {
      nextStep();
      router.push('/create-plan/costs');
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
      <StepperProgress currentStep={6} totalSteps={9} />

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Interests</Text>
          <Text style={styles.subtitle}>Pick up to 5 that fit this plan</Text>

          <View style={styles.chipsContainer}>
            {INTERESTS.map((interest) => {
              const isSelected = selectedInterests.includes(interest.id);
              return (
                <Pressable
                  key={interest.id}
                  onPress={() => toggleInterest(interest.id)}
                  style={[styles.chip, isSelected && styles.chipSelected]}>
                  <Text style={styles.chipEmoji}>{interest.emoji}</Text>
                  <Text
                    style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}
                    numberOfLines={1}>
                    {interest.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={selectedInterests.length === 0}
          style={[
            styles.continueButton,
            selectedInterests.length === 0 && styles.continueButtonDisabled,
          ]}>
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 8,
    maxWidth: '50%',
    overflow: 'hidden',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: 'white',
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
