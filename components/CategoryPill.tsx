// components/CategoryPill.tsx
import React from 'react';
import { Pressable, Text } from 'react-native';

interface CategoryPillProps {
  label: string;
  icon?: string;
  isActive: boolean;
  onPress: () => void;
}

export const CategoryPill = React.memo<CategoryPillProps>(({ 
  label, 
  icon, 
  isActive, 
  onPress 
}) => (
  <Pressable
    onPress={onPress}
    style={{
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      backgroundColor: isActive ? '#007AFF' : 'white',
      borderWidth: 1,
      borderColor: isActive ? '#007AFF' : '#E0E0E0',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginRight: 12,
    }}
  >
    {icon && <Text style={{ fontSize: 20 }}>{icon}</Text>}
    <Text
      style={{
        fontSize: 15,
        fontWeight: '500',
        color: isActive ? 'white' : '#333',
      }}
    >
      {label}
    </Text>
  </Pressable>
));