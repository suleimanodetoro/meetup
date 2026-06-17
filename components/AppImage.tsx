import { Image as ExpoImage, ImageBackground as ExpoImageBackground } from 'expo-image';
import type { ImageProps, ImageBackgroundProps } from 'expo-image';

/**
 * App-wide image component, backed by expo-image.
 *
 * Why this exists: React Native's built-in <Image> has no persistent disk cache —
 * it caches in memory only, so every avatar / event photo is re-downloaded from
 * Supabase Storage on remount, FlatList recycling, memory eviction, and app
 * restart. expo-image caches to disk + memory, so each image is fetched once per
 * device and reused thereafter. This is our single biggest egress lever.
 *
 * Drop-in for the cases we use: source={{ uri }} | source={require(...)} + style.
 * One prop difference vs RN <Image>: `resizeMode` is `contentFit` here. Call sites
 * were migrated accordingly. `cover` is the default for both, so most needed no change.
 *
 * Defaults are spread first so callers can still override (e.g. transition={0}).
 */
const DEFAULTS = {
  cachePolicy: 'memory-disk',
  transition: 120,
} as const;

export function AppImage(props: ImageProps) {
  return <ExpoImage {...DEFAULTS} {...props} />;
}

export function AppImageBackground(props: ImageBackgroundProps) {
  return <ExpoImageBackground {...DEFAULTS} {...props} />;
}
