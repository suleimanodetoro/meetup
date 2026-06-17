// components/VisitCard.tsx
import React, { useMemo } from 'react';
import { View, Text, Pressable, Dimensions, type ColorValue } from 'react-native';
import { AppImage } from '~/components/AppImage';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCountryFlag } from '~/utils/countryFlags';
import { getPlaceholderImageUrl } from '~/utils/cityImages';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VisitCardProps {
  visit: {
    id: number | string;
    city: string;
    country?: string;
    country_code?: string;
    start_date: string;
    end_date: string;
    user_count?: number;
    image_url?: string;
    recent_users?: {
      id: string;
      full_name?: string;
      avatar_url?: string;
    }[];
  };
}

// 2-color gradient tuple type
type GradientTuple = readonly [ColorValue, ColorValue];

// Stable palette for fallback
const GRADIENTS: readonly GradientTuple[] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'],
  ['#a8edea', '#fed6e3'],
  ['#ff9a9e', '#fecfef'],
] as const;

export const VisitCard = React.memo<VisitCardProps>(({ visit }) => {
  // Generate stable gradient based on city name
  const gradientColors = useMemo<GradientTuple>(() => {
    const hash = visit.city.split('').reduce((acc: number, char: string) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const index = Math.abs(hash) % GRADIENTS.length;
    return GRADIENTS[index];
  }, [visit.city]);

  // Prefer the curated image when present; only fall back to a city-seeded
  // placeholder otherwise. (Previously always used the placeholder, discarding
  // the real visit.image_url the home feed sets.)
  const displayImageUrl = useMemo(() => {
    return visit.image_url || getPlaceholderImageUrl(visit.city);
  }, [visit.image_url, visit.city]);

  const recentUsers = useMemo(() => {
    const seen = new Set<string>();
    return (visit.recent_users || []).filter((user, index) => {
      const identity = user?.id || `anonymous-${index}`;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  }, [visit.recent_users]);

  const travelerCount = Math.max(visit.user_count || 0, recentUsers.length);
  const travelerLabel =
    travelerCount > 0
      ? `${travelerCount} traveler${travelerCount === 1 ? '' : 's'} going`
      : 'Be the first to go';

  // Safe date formatting
  const dateRange = useMemo(() => {
    try {
      if (!visit.start_date || !visit.end_date) return 'Dates TBD';
      const start = new Date(visit.start_date);
      const end = new Date(visit.end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Dates TBD';
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const startStr = start.toLocaleDateString('en-US', options);
      const endStr = end.toLocaleDateString('en-US', options);
      return `${startStr} - ${endStr}`;
    } catch {
      return 'Dates TBD';
    }
  }, [visit.start_date, visit.end_date]);

  return (
    <Pressable
      onPress={() => {
        if (!visit?.city) return;
        router.push(`/city/${encodeURIComponent(visit.city)}` as never);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open visit to ${visit.city}`}
      hitSlop={8}
      style={{
        width: SCREEN_WIDTH * 0.85,
        height: 240,
        marginRight: 16,
        borderRadius: 20,
        overflow: 'hidden',
      }}>
      {/* Base gradient background (fallback) */}
      <LinearGradient
        colors={gradientColors}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
      />

      {/* City or event image overlay */}
      {displayImageUrl && (
        <AppImage
          source={{ uri: displayImageUrl }}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
          }}
          contentFit="cover"
          onError={() => {}}
        />
      )}

      {/* Subtle bottom gradient for text readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '50%',
        }}
      />

      {/* Content */}
      <View
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text
            style={{
              fontSize: 24,
              marginRight: 8,
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}>
            {visit.country_code ? getCountryFlag(visit.country_code) : '🌍'}
          </Text>
          <Text
            style={{
              color: 'white',
              fontSize: 22,
              fontWeight: 'bold',
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}>
            {visit.city}
          </Text>
        </View>

        <Text
          style={{
            color: 'white',
            fontSize: 14,
            opacity: 0.95,
            textShadowColor: 'rgba(0, 0, 0, 0.75)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}>
          {dateRange}
        </Text>

        {/* Recent users + count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            {recentUsers.slice(0, 4).map((user, i) => (
              <View
                key={`${visit.id}-user-${user?.id || i}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#E0E0E0',
                  borderWidth: 2,
                  borderColor: 'white',
                  marginLeft: i === 0 ? 0 : -12,
                  overflow: 'hidden',
                }}>
                {user?.avatar_url ? (
                  <AppImage
                    source={{ uri: user.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <Ionicons name="person" size={16} color="#999" />
                  </View>
                )}
              </View>
            ))}
          </View>

          <Text
            style={{
              color: 'white',
              fontSize: 13,
              marginLeft: 8,
              fontWeight: '600',
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}>
            {travelerLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export default VisitCard;
