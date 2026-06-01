import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickAndEncodeImage } from '~/utils/pickAndEncodeImage';
import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';
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
    <View style={styles.container}>
      <Pressable onPress={pick} style={styles.photoCard}>
        {value?.uri ? (
          <Image source={{ uri: value.uri }} style={styles.photo} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="camera" size={30} color={authColors.accent} />
            <Text style={styles.placeholderText}>Add profile photo</Text>
          </View>
        )}
      </Pressable>

      {value?.uri ? (
        <Pressable onPress={pick} style={styles.changeButton}>
          <Text style={styles.changeText}>Change photo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: authSpace.lg,
  },
  photoCard: {
    width: 280,
    height: 280,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: authColors.accent,
    borderStyle: 'dashed',
    backgroundColor: authColors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    gap: authSpace.sm,
  },
  placeholderText: {
    color: authColors.textPrimary,
    fontSize: authType.label.fontSize,
    fontWeight: '700',
  },
  changeButton: {
    marginTop: authSpace.lg,
    paddingVertical: authSpace.md,
    paddingHorizontal: authSpace.xl,
    backgroundColor: authColors.surface,
    borderRadius: authRadius.pill,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
  },
  changeText: {
    color: authColors.accent,
    fontSize: authType.label.fontSize,
    fontWeight: '700',
  },
});
