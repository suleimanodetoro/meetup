import { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import DatePicker from 'react-native-date-picker';
import type { StepBodyProps } from '../types';

export interface BasicValue {
  full_name: string;
  birth_date: string; // ISO date string (YYYY-MM-DD)
}

function calculateAge(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return age;
}

const PHOTO_COLLAGE = [
  { uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200', top: 100, left: 20, size: 80 },
  { uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200', top: 150, right: 30, size: 100 },
  { uri: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200', top: 200, left: 100, size: 120 },
  { uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', top: 280, right: 80, size: 90 },
  { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', top: 320, left: 40, size: 70 },
] as const;

export function BasicField({ value, setValue }: StepBodyProps<BasicValue>) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const name = value?.full_name ?? '';
  const birthDate = value?.birth_date
    ? new Date(value.birth_date)
    : new Date(1998, 0, 1);

  const update = (patch: Partial<BasicValue>) => {
    setValue({
      full_name: patch.full_name ?? name,
      birth_date:
        patch.birth_date ?? (value?.birth_date ?? birthDate.toISOString().split('T')[0]),
    });
  };

  return (
    <>
      {/* Photo collage background, decorative */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: -120, left: -30, right: -30,
          height: 400, opacity: 0.3,
        }}
      >
        {PHOTO_COLLAGE.map((p, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: p.top,
              left: 'left' in p ? p.left : undefined,
              right: 'right' in p ? p.right : undefined,
            }}
          >
            <Image
              source={{ uri: p.uri }}
              style={{ width: p.size, height: p.size, borderRadius: p.size / 2 }}
            />
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        Your first name
      </Text>
      <TextInput
        value={name}
        onChangeText={(text) => update({ full_name: text })}
        placeholder="Enter your name"
        style={{
          backgroundColor: 'white', padding: 20, borderRadius: 16,
          fontSize: 18, marginBottom: 30, borderWidth: 2, borderColor: '#007AFF',
        }}
      />

      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        Your Birthday
      </Text>
      <Pressable
        onPress={() => setShowDatePicker(true)}
        style={{
          backgroundColor: 'white', padding: 20, borderRadius: 16,
          marginBottom: 30, borderWidth: 2, borderColor: '#007AFF',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: '#333' }}>
            {birthDate.toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </Text>
          <Text style={{ fontSize: 16, color: '#666' }}>
            Age {calculateAge(birthDate)}
          </Text>
        </View>
      </Pressable>

      <DatePicker
        modal
        open={showDatePicker}
        date={birthDate}
        mode="date"
        maximumDate={new Date()}
        minimumDate={new Date(1920, 0, 1)}
        onConfirm={(date) => {
          update({ birth_date: date.toISOString().split('T')[0] });
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
        title="Select your birthday"
      />
    </>
  );
}
