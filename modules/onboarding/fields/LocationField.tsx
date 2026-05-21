import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { StepBodyProps } from '../types';

export interface LocationValue {
  city: string;
  country: string | null;
  country_code: string | null;
}

/**
 * Detects the user's city via expo-location. The "value" is the detected
 * location; the body is the educational UI + the detect button. Continue
 * advances only after detection (or after the user skips).
 */
export function LocationField({ value, setValue }: StepBodyProps<LocationValue>) {
  const [busy, setBusy] = useState(false);

  const detect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Denied',
          'You can always enable location later in settings.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const city =
        place?.city || place?.district || place?.subregion || place?.region;
      if (!city) {
        Alert.alert(
          'Location Detection Issue',
          'Could not determine your city. You can set it manually later.',
        );
        return;
      }
      setValue({
        city,
        country: place?.country ?? null,
        country_code: place?.isoCountryCode ?? null,
      });
    } catch (err) {
      console.error('Location error:', err);
      Alert.alert(
        'Location Error',
        'Unable to detect your location. You can set it manually later.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}
    >
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: 'white',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 32,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <Ionicons
          name={value ? 'checkmark-circle' : 'location'}
          size={60}
          color={value ? '#4CAF50' : '#007AFF'}
        />
      </View>

      <Text
        style={{
          fontSize: 24,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 16,
          color: '#1A1A1A',
        }}
      >
        {value ? `You're in ${value.city}!` : 'Find people nearby'}
      </Text>

      <Text
        style={{
          fontSize: 16,
          textAlign: 'center',
          color: '#666',
          lineHeight: 24,
          marginBottom: 32,
          paddingHorizontal: 20,
        }}
      >
        {value
          ? "Great! We'll show you people and plans in your area"
          : 'Let us detect your city to show you nearby travelers and local plans'}
      </Text>

      {!value ? (
        <Pressable
          onPress={detect}
          disabled={busy}
          style={{
            backgroundColor: busy ? '#BDBDBD' : '#007AFF',
            paddingHorizontal: 50,
            paddingVertical: 18,
            borderRadius: 30,
            minWidth: 250,
            alignItems: 'center',
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
              Detect My City
            </Text>
          )}
        </Pressable>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.6)',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 12,
          marginTop: 20,
        }}
      >
        <Ionicons name="shield-checkmark-outline" size={16} color="#666" />
        <Text
          style={{
            fontSize: 13,
            color: '#666',
            marginLeft: 8,
            fontWeight: '500',
          }}
        >
          We only store your city, not exact location
        </Text>
      </View>
    </View>
  );
}
