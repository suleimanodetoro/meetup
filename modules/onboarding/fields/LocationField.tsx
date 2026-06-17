import { StyleSheet, Text, View } from 'react-native';
import { AppImageBackground } from '~/components/AppImage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { StepBodyProps } from '../types';
import { authColors, authSpace } from '~/utils/authTheme';

export interface LocationValue {
  city: string;
  country: string | null;
  country_code: string | null;
}

const LOCATION_BENEFITS = [
  {
    icon: 'checkmark' as const,
    text: 'We store your city, not your exact location.',
  },
  {
    icon: 'lock-closed' as const,
    text: 'Your exact location is never shown to other people.',
  },
];

const HERO_IMAGE_URI =
  'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=900';

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
      <View style={styles.heroCard} accessibilityIgnoresInvertColors>
        <AppImageBackground
          source={{ uri: HERO_IMAGE_URI }}
          contentFit="cover"
          style={styles.heroImage}
          imageStyle={styles.heroImageInner}
        />
        <View style={styles.heroScrim} />
        <View style={styles.locationPill}>
          <Ionicons name="navigate" size={15} color={authColors.ctaPrimaryText} />
          <Text style={styles.locationPillText}>Current city</Text>
        </View>
        <View style={styles.avatarBubble}>
          <View style={styles.avatarPreview} />
          <View style={styles.heartBadge}>
            <Ionicons name="people" size={18} color={authColors.accent} />
          </View>
        </View>
      </View>

      <Text style={styles.title}>
        {value ? `${value.city} is your current city` : 'Find people near your plans'}
      </Text>
      <Text style={styles.body}>
        Allow location so Waypoint can introduce you to people and plans nearby. Your precise
        location is never revealed.
      </Text>

      <View style={styles.benefitsList}>
        {LOCATION_BENEFITS.map((benefit) => (
          <View key={benefit.text} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Ionicons name={benefit.icon} size={15} color={authColors.ctaPrimaryText} />
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
  heroCard: {
    height: 168,
    marginTop: authSpace.sm,
    marginBottom: authSpace.xl,
    borderRadius: 28,
    backgroundColor: authColors.accentSoft,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageInner: {
    borderRadius: 28,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 35, 80, 0.20)',
  },
  locationPill: {
    position: 'absolute',
    left: authSpace.lg,
    bottom: authSpace.lg,
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: authSpace.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.82)',
  },
  locationPillText: {
    color: authColors.ctaPrimaryText,
    fontSize: 13,
    fontWeight: '800',
  },
  avatarBubble: {
    position: 'absolute',
    right: authSpace.lg,
    top: authSpace.lg,
    width: 82,
    height: 48,
    borderRadius: 14,
    backgroundColor: authColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  avatarPreview: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: authColors.accentBorder,
    borderWidth: 2,
    borderColor: authColors.surface,
  },
  heartBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.surface,
  },
  title: {
    color: authColors.textPrimary,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: authSpace.md,
  },
  body: {
    color: authColors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 'auto',
  },
  benefitsList: {
    gap: authSpace.md,
    marginBottom: authSpace.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: authSpace.sm,
    backgroundColor: authColors.accent,
  },
  benefitText: {
    flex: 1,
    color: authColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
});
