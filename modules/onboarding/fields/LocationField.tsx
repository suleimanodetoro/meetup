import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { StepBodyProps } from '../types';
import { authSpace, authType } from '~/utils/authTheme';

export interface LocationValue {
  city: string;
  country: string | null;
  country_code: string | null;
}

const LOCATION_BENEFITS = [
  {
    icon: 'checkmark' as const,
    bg: '#F2E9FF',
    color: '#6E2FEA',
    text: 'Check in to record where life takes you',
  },
  {
    icon: 'notifications' as const,
    bg: '#FCEAF6',
    color: '#B63A9C',
    text: 'Get timely reminders for plans near you',
  },
  {
    icon: 'map' as const,
    bg: '#E8F7F0',
    color: '#168A63',
    text: 'Build a personalized map of your visits',
  },
  {
    icon: 'star' as const,
    bg: '#F7F1E3',
    color: '#9A7417',
    text: 'Discover must-visit spots around you',
  },
];

export async function detectCurrentCity(): Promise<LocationValue> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error(
      'Location permission is required so Waypoint can show nearby people and plans.'
    );
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Lowest,
  });
  const [place] = await Location.reverseGeocodeAsync({
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  });
  const city = place?.city || place?.district || place?.subregion || place?.region;

  if (!city) {
    throw new Error('We could not detect your city. Please try again.');
  }

  return {
    city,
    country: place?.country ?? null,
    country_code: place?.isoCountryCode ?? null,
  };
}

/**
 * Educational UI for location permission. The frame's single Continue CTA
 * owns detection through the step commit, so this body stays visual only.
 */
export function LocationField({ value }: StepBodyProps<LocationValue>) {
  return (
    <View style={styles.container}>
      <View style={styles.mapHero} accessibilityIgnoresInvertColors>
        <View style={[styles.mapCard, styles.mapCardLeft]}>
          <View style={styles.waterBlock} />
          <View style={[styles.parkBlock, styles.parkBlockLeft]} />
          <View style={[styles.road, styles.roadA]} />
          <View style={[styles.road, styles.roadB]} />
          <View style={[styles.road, styles.roadC]} />
          <View style={styles.mapPin}>
            <Ionicons name="restaurant" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.mapLabel}>
            <Text style={styles.mapLabelTitle}>Tomi Jazz</Text>
            <Text style={styles.mapLabelSubtitle}>nearby plan</Text>
          </View>
        </View>

        <View style={[styles.mapCard, styles.mapCardRight]}>
          <View style={[styles.waterBlock, styles.waterBlockRight]} />
          <View style={styles.islandBlock} />
          <View style={[styles.road, styles.roadD]} />
          <View style={[styles.road, styles.roadE]} />
          <View style={[styles.mapPin, styles.mapPinPurple]}>
            <Ionicons name="person" size={18} color="#FFFFFF" />
          </View>
          <View style={[styles.mapLabel, styles.mapLabelPurple]}>
            <Text style={[styles.mapLabelTitle, styles.mapLabelTitlePurple]}>Liberty Island</Text>
            <Text style={[styles.mapLabelSubtitle, styles.mapLabelSubtitlePurple]}>
              friends checked in
            </Text>
          </View>
        </View>

        <View style={styles.locatorButton}>
          <Ionicons name="navigate" size={32} color="#3C7CF3" />
        </View>
      </View>

      {value ? (
        <View style={styles.detectedPill}>
          <Ionicons name="checkmark-circle" size={18} color="#34C759" />
          <Text style={styles.detectedText}>{value.city} is set</Text>
        </View>
      ) : null}

      <View style={styles.benefitsList}>
        {LOCATION_BENEFITS.map((benefit) => (
          <View key={benefit.text} style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: benefit.bg }]}>
              <Ionicons name={benefit.icon} size={17} color={benefit.color} />
            </View>
            <Text style={styles.benefitText}>{benefit.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  mapHero: {
    height: 224,
    marginTop: authSpace.md,
    marginBottom: authSpace.xl,
    position: 'relative',
  },
  mapCard: {
    position: 'absolute',
    width: 178,
    height: 150,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#F3F1EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 6,
  },
  mapCardLeft: {
    left: 0,
    top: 22,
    transform: [{ rotate: '-1deg' }],
  },
  mapCardRight: {
    right: 0,
    top: 44,
    transform: [{ rotate: '3deg' }],
  },
  waterBlock: {
    position: 'absolute',
    left: -30,
    top: 0,
    width: 96,
    height: 170,
    backgroundColor: '#C8E7F4',
    transform: [{ rotate: '14deg' }],
  },
  waterBlockRight: {
    left: -10,
    width: 210,
    backgroundColor: '#BDECF7',
  },
  parkBlock: {
    position: 'absolute',
    backgroundColor: '#BFE6B6',
  },
  parkBlockLeft: {
    right: -18,
    bottom: -16,
    width: 118,
    height: 78,
    borderRadius: 38,
  },
  islandBlock: {
    position: 'absolute',
    left: 42,
    top: 38,
    width: 100,
    height: 70,
    borderRadius: 34,
    backgroundColor: '#BFE6A8',
    borderWidth: 3,
    borderColor: '#E5C3E9',
  },
  road: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },
  roadA: {
    left: 8,
    right: 12,
    top: 88,
    transform: [{ rotate: '-8deg' }],
  },
  roadB: {
    left: 52,
    right: 18,
    top: 44,
    transform: [{ rotate: '18deg' }],
  },
  roadC: {
    left: 86,
    width: 4,
    height: 120,
    top: 20,
    transform: [{ rotate: '8deg' }],
  },
  roadD: {
    left: 36,
    right: 28,
    top: 72,
    transform: [{ rotate: '-20deg' }],
  },
  roadE: {
    left: 74,
    width: 4,
    height: 94,
    top: 32,
    transform: [{ rotate: '24deg' }],
  },
  mapPin: {
    position: 'absolute',
    left: 20,
    top: 24,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B1A',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mapPinPurple: {
    left: 92,
    top: 22,
    backgroundColor: '#6E2FEA',
  },
  mapLabel: {
    position: 'absolute',
    left: 62,
    right: 10,
    top: 23,
  },
  mapLabelPurple: {
    left: 20,
    right: 16,
    top: 78,
  },
  mapLabelTitle: {
    color: '#E85D04',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
  },
  mapLabelTitlePurple: {
    color: '#6E2FEA',
    fontSize: 18,
    lineHeight: 21,
    textAlign: 'center',
  },
  mapLabelSubtitle: {
    color: '#F47B20',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  mapLabelSubtitlePurple: {
    color: '#6E2FEA',
    textAlign: 'center',
  },
  locatorButton: {
    position: 'absolute',
    left: '50%',
    top: 122,
    width: 72,
    height: 72,
    marginLeft: -36,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  detectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: authSpace.md,
    paddingVertical: authSpace.sm,
    borderRadius: 999,
    backgroundColor: '#F0FBF4',
    marginBottom: authSpace.lg,
  },
  detectedText: {
    marginLeft: authSpace.sm,
    color: '#1F7A3F',
    fontSize: authType.disclaimer.fontSize,
    fontWeight: '600',
  },
  benefitsList: {
    gap: 13,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: authSpace.md,
  },
  benefitText: {
    flex: 1,
    color: '#26302E',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
});
