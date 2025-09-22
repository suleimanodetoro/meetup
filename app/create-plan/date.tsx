// app/create-plan/date.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from 'react-native-date-picker';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '../contexts/CreatePlanContext';

export default function DateScreen() {
  const { formData, updateField, nextStep, canContinue } = useCreatePlan();
  const [startDate, setStartDate] = useState(formData.startDate);
  const [endDate, setEndDate] = useState(formData.endDate || formData.startDate);
  const [isOneDay, setIsOneDay] = useState(formData.isOneDay);
  const [isAllDay, setIsAllDay] = useState(formData.isAllDay);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    updateField('startDate', startDate);
    updateField('endDate', isOneDay ? undefined : endDate);
    updateField('isOneDay', isOneDay);
    updateField('isAllDay', isAllDay);
  }, [startDate, endDate, isOneDay, isAllDay]);

  const handleContinue = () => {
    if (canContinue()) {
      nextStep();
      router.push('/create-plan/destinations');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
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
      <StepperProgress currentStep={4} totalSteps={9} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Date</Text>
        <Text style={styles.subtitle}>When is the activity?</Text>

        {/* Toggles */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>One-day event</Text>
            <Switch
              value={isOneDay}
              onValueChange={setIsOneDay}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor="white"
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>All-day</Text>
            <Switch
              value={isAllDay}
              onValueChange={setIsAllDay}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Date Fields */}
        <Pressable
          onPress={() => setShowStartPicker(true)}
          style={styles.dateField}
        >
          <Ionicons name="calendar-outline" size={20} color="#666" />
          <View style={styles.dateContent}>
            <Text style={styles.dateLabel}>
              {isOneDay ? 'Date' : 'Start Date'}
            </Text>
            <Text style={styles.dateValue}>
              {formatDate(startDate)}
              {!isAllDay && ` at ${formatTime(startDate)}`}
            </Text>
          </View>
        </Pressable>

        {!isOneDay && (
          <Pressable
            onPress={() => setShowEndPicker(true)}
            style={styles.dateField}
          >
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <View style={styles.dateContent}>
              <Text style={styles.dateLabel}>End Date</Text>
              <Text style={styles.dateValue}>
                {formatDate(endDate)}
                {!isAllDay && ` at ${formatTime(endDate)}`}
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </View>

      {/* Date Pickers */}
      <DatePicker
        modal
        open={showStartPicker}
        date={startDate}
        mode={isAllDay ? 'date' : 'datetime'}
        minimumDate={new Date()}
        onConfirm={(date) => {
          setStartDate(date);
          setShowStartPicker(false);
          if (isOneDay) {
            setEndDate(date);
          }
        }}
        onCancel={() => setShowStartPicker(false)}
      />

      <DatePicker
        modal
        open={showEndPicker}
        date={endDate}
        mode={isAllDay ? 'date' : 'datetime'}
        minimumDate={startDate}
        onConfirm={(date) => {
          setEndDate(date);
          setShowEndPicker(false);
        }}
        onCancel={() => setShowEndPicker(false)}
      />
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
  toggleContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
  },
  dateField: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateContent: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
  continueButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
});