// ============================================
// components/PlanCardHome.tsx
// ============================================
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Dimensions,
  type ColorValue,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getCountryFlag } from '~/utils/countryFlags';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlanCardProps {
  plan: {
    id: number | string;
    title?: string;
    city?: string;
    country?: string;
    country_code?: string;
    image_uri?: string;
    attendee_count?: number;
    recent_attendees?: Array<{
      id: string;
      full_name?: string;
      avatar_url?: string;
    }>;
  };
}

// 2-color gradient tuple type
type GradientTuple = readonly [ColorValue, ColorValue];

// Stable palette
const GRADIENTS: readonly GradientTuple[] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
] as const;

// Hash any id (number or string) to an index in [0, len)
function hashToIndex(key: number | string, len: number) {
  if (typeof key === 'number') return Math.abs(key) % len;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

export const PlanCardHome = React.memo<PlanCardProps>(({ plan }) => {
  const [imageError, setImageError] = useState(false);

  // If the image URI changes, allow it to try again
  useEffect(() => {
    setImageError(false);
  }, [plan.image_uri]);

  const gradientColors = useMemo<GradientTuple>(() => {
    const idx = hashToIndex(plan.id, GRADIENTS.length);
    return GRADIENTS[idx];
  }, [plan.id]);

  const attendeeCount = plan.attendee_count ?? 0;
  const attendees = (plan.recent_attendees || []).slice(0, 3);

  return (
    <Pressable
      onPress={() => router.push(`/event/${plan.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open plan ${plan.title ?? 'Untitled Plan'}`}
      hitSlop={8}
      style={{
        width: SCREEN_WIDTH * 0.6,
        marginRight: 16,
      }}
    >
      <View
        style={{
          height: 160,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {plan.image_uri && !imageError ? (
          <Image
            source={{ uri: plan.image_uri }}
            style={{ width: '100%', height: '100%' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <LinearGradient
            colors={gradientColors}
            style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="calendar" size={40} color="rgba(255,255,255,0.5)" />
          </LinearGradient>
        )}
      </View>

      <Text
        style={{
          fontSize: 17,
          fontWeight: '600',
          marginBottom: 6,
        }}
        numberOfLines={2}
      >
        {plan.title || 'Untitled Plan'}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>
          {plan.country_code ? getCountryFlag(plan.country_code) : '🌍'}
        </Text>

        <Text
          style={{ color: '#666', fontSize: 14, maxWidth: SCREEN_WIDTH * 0.32 }}
          numberOfLines={1}
        >
          {plan.country || plan.city || 'Location TBD'}
        </Text>

        {attendeeCount > 0 && (
          <View
            style={{
              flexDirection: 'row',
              marginLeft: 'auto',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              {attendees.map((user, i) => (
                <View
                  key={`${plan.id}-attendee-${user?.id || i}`}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: '#E0E0E0',
                    borderWidth: 2,
                    borderColor: 'white',
                    marginLeft: i === 0 ? 0 : -8,
                    overflow: 'hidden',
                  }}
                >
                  {user?.avatar_url ? (
                    <Image
                      source={{ uri: user.avatar_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="person" size={12} color="#999" />
                    </View>
                  )}
                </View>
              ))}
            </View>

            <Text style={{ fontSize: 12, color: '#666', marginLeft: 4 }}>
              {attendeeCount}+
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

export default PlanCardHome;
