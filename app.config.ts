// app.config.ts
import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: 'Waypoint',
  slug: 'waypoint',
  version: '1.0.2',
  scheme: 'waypoint',
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-video',
    'expo-web-browser',
    'expo-apple-authentication',
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: 'com.googleusercontent.apps.545991292691-7qfgijc8l5j7de4no0ukkd4mdurcmni8',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'This app needs to access your photos library to let you upload it online',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location.',
        locationWhenInUsePermission: 'Show current location on map.',
      },
    ],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN || '',
        RNMapboxMapsVersion: '11.13.4',
      },
    ],
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon-light.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        // Dark mode splash
        dark: {
          image: './assets/splash-icon-dark.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#000000',
        },
        ios: {
          image: './assets/splash-icon-light.png',
          imageWidth: 200,
          backgroundColor: '#ffffff',
          dark: {
            image: './assets/splash-icon-dark.png',
            backgroundColor: '#000000',
          },
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',

  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.usewaypoint',
    buildNumber: '10',
    usesAppleSignIn: true,
    icon: {
      light: './assets/ios-light.png',
      dark: './assets/ios-dark.png',
      tinted: './assets/ios-tinted.png',
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            'waypoint',
            'com.googleusercontent.apps.545991292691-7qfgijc8l5j7de4no0ukkd4mdurcmni8',
          ],
        },
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'app.usewaypoint',
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
  },
  extra: {
    EXPO_PUBLIC_MAPBOX_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    router: {},
    eas: {
      projectId: '59572940-70a6-4674-9ba0-52b56edd8f29',
    },
  },
});
