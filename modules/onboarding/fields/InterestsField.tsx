import { Alert, Pressable, Text, View } from 'react-native';
import { SORTED_INTERESTS as INTERESTS, type InterestId } from '~/utils/constants';
import type { StepBodyProps } from '../types';

const MAX_INTERESTS = 5;

export function InterestsField({
  value,
  setValue,
}: StepBodyProps<InterestId[]>) {
  const selected = value ?? [];

  const toggle = (id: InterestId) => {
    if (selected.includes(id)) {
      setValue(selected.filter((s) => s !== id));
      return;
    }
    if (selected.length >= MAX_INTERESTS) {
      Alert.alert(
        'Maximum Interests',
        `You can select up to ${MAX_INTERESTS} interests`,
      );
      return;
    }
    setValue([...selected, id]);
  };

  return (
    <>
      <View style={{ position: 'absolute', right: -20, top: 0 }}>
        <Text style={{ fontSize: 56 }}>🏄‍♀️</Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 8,
        }}
      >
        {INTERESTS.map((i) => {
          const isSelected = selected.includes(i.id);
          return (
            <Pressable
              key={i.id}
              onPress={() => toggle(i.id)}
              style={{
                marginBottom: 12,
                marginRight: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 9999,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderWidth: 1,
                backgroundColor: isSelected ? '#007AFF' : 'white',
                borderColor: isSelected ? '#007AFF' : '#E0E0E0',
              }}
            >
              <Text style={{ marginRight: 8, fontSize: 17 }}>{i.emoji}</Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: isSelected ? 'white' : '#333',
                }}
              >
                {i.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
