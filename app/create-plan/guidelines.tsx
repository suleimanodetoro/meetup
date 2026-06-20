// app/create-plan/guidelines.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, SafeAreaView, Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import CreatePlanHeader from '~/components/CreatePlanHeader';
import { useCreatePlan } from '~/contexts/CreatePlanContext';

export default function GuidelinesScreen() {
  const { formData, updateField, nextStep, setStep } = useCreatePlan();
  const [accepted, setAccepted] = useState(formData.guidelinesAccepted || false);

  useFocusEffect(
    useCallback(() => {
      setStep(8);
    }, [setStep]),
  );
  const handleContinue = () => {
    updateField('guidelinesAccepted', true);
    nextStep();
    router.push('/create-plan/review');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <CreatePlanHeader />

      {/* Progress */}
      <StepperProgress currentStep={8} totalSteps={9} />

      <ScrollView className="flex-1">
        <View className="px-6 pb-6 pt-8">
          <Text className="text-3xl font-bold">Before you create</Text>
          <Text className="mt-1 text-base text-gray-600">Keep this safe for everyone</Text>

          {/* Simple Guidelines List */}
          <View className="mt-8 rounded-2xl bg-gray-50 p-5">
            <View className="space-y-4">
              <View className="flex-row">
                <Text className="mr-3 text-gray-400">•</Text>
                <Text className="flex-1 text-base text-gray-700">No illegal activity</Text>
              </View>

              <View className="flex-row">
                <Text className="mr-3 text-gray-400">•</Text>
                <Text className="flex-1 text-base text-gray-700">Be respectful to everyone</Text>
              </View>

              <View className="flex-row">
                <Text className="mr-3 text-gray-400">•</Text>
                <Text className="flex-1 text-base text-gray-700">Keep details accurate</Text>
              </View>

              <View className="flex-row">
                <Text className="mr-3 text-gray-400">•</Text>
                <Text className="flex-1 text-base text-gray-700">Show up or notify of changes</Text>
              </View>
            </View>
          </View>

          {/* Single Checkbox */}
          <Pressable
            onPress={() => setAccepted(!accepted)}
            className="mt-8 flex-row items-center rounded-xl bg-white p-4 shadow-sm">
            <View
              className={`mr-4 h-6 w-6 items-center justify-center rounded-md border-2 ${
                accepted ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 bg-white'
              }`}>
              {accepted && <Ionicons name="checkmark" size={16} color="white" />}
            </View>
            <Text className="flex-1 text-base text-gray-700">
              I understand and will follow these guidelines
            </Text>
          </Pressable>

          {/* Terms Link */}
          <Pressable
            onPress={() => {
              Linking.openURL('https://www.usewaypoint.app/terms');
            }}
            className="mt-6 items-center">
            <Text className="text-sm text-blue-600 underline">
              View full terms and conditions on our website
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View className="border-t border-gray-200 bg-white px-5 pb-8 pt-4">
        <Pressable
          onPress={handleContinue}
          disabled={!accepted}
          className={`items-center justify-center rounded-2xl py-4 ${
            accepted ? 'bg-indigo-600' : 'bg-gray-300'
          }`}>
          <Text className="text-center text-lg font-semibold text-white">Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
