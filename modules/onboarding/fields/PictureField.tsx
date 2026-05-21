import { Image, Pressable, Text, View } from 'react-native';
import { pickAndEncodeImage } from '~/utils/pickAndEncodeImage';
import type { StepBodyProps } from '../types';

export interface PictureValue {
  uri: string;
  base64: string | null;
}

export function PictureField({ value, setValue }: StepBodyProps<PictureValue>) {
  const pick = async () => {
    const picked = await pickAndEncodeImage([1, 1], 2000, 0.5);
    if (picked) setValue({ uri: picked.uri, base64: picked.base64 });
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', paddingTop: 20 }}>
      <View style={{ position: 'absolute', right: 0, top: -20 }}>
        <Text style={{ fontSize: 60 }}>📷</Text>
      </View>

      <Pressable
        onPress={pick}
        style={{
          width: 280,
          height: 280,
          borderRadius: 20,
          borderWidth: 3,
          borderColor: '#007AFF',
          borderStyle: 'dashed',
          backgroundColor: 'white',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {value?.uri ? (
          <Image
            source={{ uri: value.uri }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#E3F2FD',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 30, color: '#007AFF' }}>+</Text>
          </View>
        )}
      </Pressable>

      {value?.uri ? (
        <Pressable
          onPress={pick}
          style={{
            marginTop: 20,
            paddingVertical: 10,
            paddingHorizontal: 20,
            backgroundColor: 'white',
            borderRadius: 20,
          }}
        >
          <Text style={{ color: '#007AFF', fontWeight: '600' }}>
            Change Photo
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
