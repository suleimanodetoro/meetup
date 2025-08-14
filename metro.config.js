// metro.config.js

// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Ensure asset extensions include .glb, .gltf, etc.
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'glb',
  'gltf',
  'png',
  'jpg'
];

// Ensure source extensions include the necessary script formats
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'cjs',
  'mjs'
];

// Wrap with NativeWind
module.exports = withNativeWind(config, { input: './global.css' });
