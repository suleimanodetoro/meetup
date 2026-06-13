// utils/pickAndEncodeImage.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export async function pickAndEncodeImage(
  aspect: [number, number],
  maxWidth = 1024, // avatars/plan images render <= ~400px; 1024 is plenty and cuts upload+egress bytes ~4x vs 2000
  compress = 0.8
): Promise<{ uri: string; base64: string } | null> {
  // Check current permission status first. On iOS the user may grant
  // "Limited" access (a subset of photos) — `accessPrivileges` exposes that;
  // the legacy `status` enum does not, so use it for the limited check.
  const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
  const isLimited = (p: { accessPrivileges?: string }) =>
    p.accessPrivileges === 'limited';

  if (!currentPerm.granted && !isLimited(currentPerm)) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && !isLimited(perm)) {
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