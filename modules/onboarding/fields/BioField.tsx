import { Text, TextInput, View } from 'react-native';
import type { StepBodyProps } from '../types';

const MAX_LENGTH = 300;

export function BioField({ value, setValue }: StepBodyProps<string>) {
  const bio = value ?? '';

  return (
    <>
      <View style={{ position: 'absolute', right: 0, top: -30, zIndex: -1 }}>
        <Text style={{ fontSize: 60 }}>✏️</Text>
      </View>

      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 16,
          minHeight: 200,
          borderWidth: 2,
          borderColor: bio.length > 0 ? '#007AFF' : '#E0E0E0',
          marginBottom: 20,
        }}
      >
        <TextInput
          value={bio}
          onChangeText={setValue}
          placeholder="Share a bit about yourself..."
          placeholderTextColor="#9E9E9E"
          multiline
          maxLength={MAX_LENGTH}
          style={{
            fontSize: 16,
            lineHeight: 24,
            color: '#333',
            textAlignVertical: 'top',
            minHeight: 160,
          }}
        />
        <Text
          style={{
            alignSelf: 'flex-end',
            marginTop: 8,
            fontSize: 12,
            color: bio.length > MAX_LENGTH * 0.9 ? '#FF6B6B' : '#9E9E9E',
          }}
        >
          {bio.length}/{MAX_LENGTH}
        </Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>💡 Tips:</Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
          • Share what makes you unique
        </Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
          • Mention your hobbies and interests
        </Text>
        <Text style={{ fontSize: 13, color: '#666' }}>
          • Tell us what you love to do for fun
        </Text>
      </View>
    </>
  );
}
