// components/InterestsSelector.tsx
import React from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { INTERESTS } from '~/utils/constants';

interface InterestsSelectorProps {
  selectedInterests: string[];
  onToggleInterest: (interestId: string) => void;
  maxSelections?: number;
}

export default function InterestsSelector({ 
  selectedInterests, 
  onToggleInterest,
  maxSelections = 5 
}: InterestsSelectorProps) {
  
  const handleToggle = (interestId: string) => {
    if (selectedInterests.includes(interestId)) {
      onToggleInterest(interestId);
    } else {
      if (selectedInterests.length >= maxSelections) {
        Alert.alert('Maximum Reached', `You can select up to ${maxSelections} interests`);
        return;
      }
      onToggleInterest(interestId);
    }
  };

  return (
    <ScrollView 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 20
      }}>
        {INTERESTS.map((interest) => {
          const isSelected = selectedInterests.includes(interest.id);
          return (
            <Pressable
              key={interest.id}
              onPress={() => handleToggle(interest.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 25,
                borderWidth: 2,
                borderColor: isSelected ? '#007AFF' : '#E0E0E0',
                backgroundColor: isSelected ? '#007AFF' : 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isSelected ? 0.1 : 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 18, marginRight: 8 }}>{interest.emoji}</Text>
              <Text style={{
                fontSize: 15,
                fontWeight: isSelected ? '600' : '500',
                color: isSelected ? 'white' : '#333',
              }}>
                {interest.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Counter */}
      <View style={{ 
        marginTop: 20,
        paddingHorizontal: 20,
        alignItems: 'center'
      }}>
        <Text style={{ 
          fontSize: 14, 
          color: '#666',
          fontWeight: '500'
        }}>
          {selectedInterests.length}/{maxSelections} interests selected
        </Text>
      </View>
    </ScrollView>
  );
}