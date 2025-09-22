// app/create-plan/costs.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '../contexts/CreatePlanContext';

interface CostItem {
  name: string;
  amount?: number;
  isOptional: boolean;
  link?: string;
}

export default function CostsScreen() {
  const { formData, updateField, nextStep } = useCreatePlan();
  const [costs, setCosts] = useState<CostItem[]>(
    formData.costs.length > 0 ? formData.costs : [{ name: '', isOptional: false }]
  );
  const [noCost, setNoCost] = useState(false);

  useEffect(() => {
    updateField('costs', noCost ? [{ name: 'No expected cost', isOptional: false }] : costs);
  }, [costs, noCost]);

  const addCostItem = () => {
    setCosts([...costs, { name: '', isOptional: false }]);
  };

  const updateCostItem = (index: number, field: keyof CostItem, value: any) => {
    const newCosts = [...costs];
    newCosts[index] = { ...newCosts[index], [field]: value };
    setCosts(newCosts);
  };

  const removeCostItem = (index: number) => {
    if (costs.length === 1) {
      Alert.alert('Required', 'At least one cost item is required');
      return;
    }
    setCosts(costs.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (noCost || costs.some(c => c.name.trim())) {
      nextStep();
      router.push('/create-plan/guidelines');
    }
  };

  const canContinue = noCost || costs.some(c => c.name.trim());

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
      <StepperProgress currentStep={7} totalSteps={9} />

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Estimated Costs</Text>
          <Text style={styles.subtitle}>Help people budget</Text>

          {/* No Cost Toggle */}
          <View style={styles.noCostContainer}>
            <Text style={styles.noCostLabel}>No expected cost</Text>
            <Switch
              value={noCost}
              onValueChange={setNoCost}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor="white"
            />
          </View>

          {!noCost && (
            <>
              {/* Cost Items */}
              {costs.map((cost, index) => (
                <View key={index} style={styles.costItem}>
                  <View style={styles.costHeader}>
                    <Text style={styles.costNumber}>Item {index + 1}</Text>
                    {costs.length > 1 && (
                      <Pressable onPress={() => removeCostItem(index)}>
                        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                      </Pressable>
                    )}
                  </View>

                  <TextInput
                    value={cost.name}
                    onChangeText={(text) => updateCostItem(index, 'name', text)}
                    placeholder="Item name (e.g., Track time)"
                    placeholderTextColor="#999"
                    style={styles.input}
                  />

                  <View style={styles.row}>
                    <TextInput
                      value={cost.amount?.toString()}
                      onChangeText={(text) => updateCostItem(index, 'amount', parseFloat(text) || undefined)}
                      placeholder="Amount"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.halfInput]}
                    />
                    <View style={styles.optionalContainer}>
                      <Text style={styles.optionalLabel}>Optional</Text>
                      <Switch
                        value={cost.isOptional}
                        onValueChange={(value) => updateCostItem(index, 'isOptional', value)}
                        trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
                        thumbColor="white"
                      />
                    </View>
                  </View>

                  <TextInput
                    value={cost.link}
                    onChangeText={(text) => updateCostItem(index, 'link', text)}
                    placeholder="Menu or price link (optional)"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
              ))}

              {/* Add Item Button */}
              <Pressable onPress={addCostItem} style={styles.addButton}>
                <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
                <Text style={styles.addButtonText}>Add item</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.footerText}>
            Estimated total is based on items with a number
          </Text>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue}
          style={[
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
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
  noCostContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  noCostLabel: {
    fontSize: 16,
    color: '#333',
  },
  costItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  costHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  costNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  optionalContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  optionalLabel: {
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
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