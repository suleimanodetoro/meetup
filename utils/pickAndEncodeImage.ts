// utils/pickAndEncodeImage.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export async function pickAndEncodeImage(
  aspect: [number, number],
  maxWidth = 2000,
  compress = 0.8
): Promise<{ uri: string; base64: string } | null> {
  // Check current permission status first
  const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
  
  // Only request if not already granted or limited
  if (!currentPerm.granted && currentPerm.status !== 'limited') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.status !== 'limited') {
      return null;
    }
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',              
    allowsMultipleSelection: false,
    allowsEditing: true,
    aspect,
    quality: 1,
    base64: false,
    exif: false,
  });

  if (res.canceled) return null;
  const asset = res.assets[0];

  const ops: ImageManipulator.Action[] = [];
  if (asset.width && asset.width > maxWidth) ops.push({ resize: { width: maxWidth } });

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    ops,
    { compress, format: ImageManipulator.SaveFormat.JPEG }
  );

  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri: manipulated.uri, base64 };
}