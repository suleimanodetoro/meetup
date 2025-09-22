// app/create-plan/image.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '../contexts/CreatePlanContext';

export default function PlanImageScreen() {
  const { formData, updateField, nextStep } = useCreatePlan();
  const [busy, setBusy] = useState(false);

  const previewUri = useMemo(() => {
    if (formData?.imageUri) return formData.imageUri;
    if (formData?.imageBase64) return `data:image/jpeg;base64,${formData.imageBase64}`;
    return undefined;
  }, [formData.imageUri, formData.imageBase64]);

  const pickImage = async () => {
    try {
      setBusy(true);

      // Ask for permission (idempotent; Expo handles caching)
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow photo library access to pick an image.');
        setBusy(false);
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,       // we'll compress via ImageManipulator
        base64: false,    // we'll read base64 AFTER converting to JPEG
        exif: false,
      });

      if (res.canceled) {
        setBusy(false);
        return;
      }

      const asset = res.assets[0];

      // Convert to JPEG and optionally downscale if huge
      const ops: ImageManipulator.Action[] = [];
      if (asset.width && asset.width > 2000) {
        ops.push({ resize: { width: 2000 } });
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        ops,
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Read final JPEG as raw base64 (no data: prefix)
      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('Image processed:', {
        originalWidth: asset.width,
        originalHeight: asset.height,
        base64Length: base64.length,
        base64SizeKB: Math.round(base64.length / 1024),
        base64SizeMB: (base64.length / (1024 * 1024)).toFixed(2),
      });

      // Persist both: uri for preview, base64 for upload
      updateField('imageUri', manipulated.uri);
      updateField('imageBase64', base64);

    } catch (e: any) {
      console.error('pickImage error', e);
      Alert.alert('Image error', e?.message ?? 'Could not pick image.');
    } finally {
      setBusy(false);
    }
  };

  const clearImage = () => {
    updateField('imageUri', undefined);
    updateField('imageBase64', undefined);
  };

  const handleContinue = () => {
    nextStep();
    router.push('/create-plan/about');
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
      <StepperProgress currentStep={2} totalSteps={9} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Plan Image</Text>
        <Text style={styles.subtitle}>Add a cover image for this plan</Text>

        {/* Image Dropzone */}
        <Pressable
          onPress={pickImage}
          disabled={busy}
          style={[styles.dropzone, busy && styles.dropzoneDisabled]}
        >
          {previewUri ? (
            <>
              <Image source={{ uri: previewUri }} style={styles.image} />
              {!busy && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    clearImage();
                  }}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={32} color="white" />
                </Pressable>
              )}
            </>
          ) : (
            <View style={styles.placeholderContent}>
              {busy ? (
                <>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.dropzoneText}>Processing...</Text>
                </>
              ) : (
                <>
                  <View style={styles.iconContainer}>
                    <Ionicons name="image-outline" size={48} color="#999" />
                  </View>
                  <Text style={styles.dropzoneText}>Tap to add image</Text>
                </>
              )}
            </View>
          )}
        </Pressable>

        <Text style={styles.helperText}>
          This image will be the main visual for your activity plan
        </Text>
        
      </View>

      {/* Continue Button - Always enabled (image is optional) */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={busy}
          style={[
            styles.continueButton,
            busy && styles.continueButtonDisabled,
          ]}
        >
          <Text style={styles.continueButtonText}>
            {busy ? 'Processing...' : 'Continue'}
          </Text>
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
  dropzone: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  dropzoneDisabled: {
    opacity: 0.6,
  },
  placeholderContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8EEF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dropzoneText: {
    fontSize: 16,
    color: '#999',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 4,
  },
  helperText: {
    fontSize: 14,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 8,
    textAlign: 'center',
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