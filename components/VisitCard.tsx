// components/VisitCard.tsx
// ============================================
// FIXED: Image display logic corrected
// ============================================
import React, { useMemo } from 'react';
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
    recent_users?: Array<{
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

  // Log the image URL for debugging

  return (
    <Pressable
onPress={() => {
  console.log("Navigating with Visit:", JSON.stringify(visit, null, 2)); // 🔍 full object
  router.push(`/visit/${visit?.id}`);
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
      }}
    >
      {/* Base gradient background */}
      <LinearGradient
        colors={gradientColors}
        style={{ width: '100%', height: '100%', position: 'absolute' }}
      />

      {/* Optional city image overlay - FIXED: Should show when image_url EXISTS */}
      {visit.image_url && (
        <Image
          source={{ uri: visit.image_url }}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            opacity: 0.8,
          }}
          resizeMode="cover"
          onError={(e) => {
            console.log(`Image failed to load for ${visit.city}:`, e.nativeEvent.error);
            console.log(`Failed URL was: ${visit.image_url}`);
          }}
          onLoad={() => {
            console.log(`Image loaded successfully for ${visit.city}`);
          }}
        />
      )}

      {/* Bottom gradient to ensure text contrast */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '60%',
        }}
      />

      {/* Content */}
      <View
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 24, marginRight: 8 }}>
            {visit.country_code ? getCountryFlag(visit.country_code) : '🌍'}
          </Text>
          <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>
            {visit.city}
          </Text>
        </View>

        <Text style={{ color: 'white', fontSize: 14, opacity: 0.9 }}>
          {dateRange}
        </Text>

        {/* Recent users + count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            {(visit.recent_users || []).slice(0, 4).map((user, i) => (
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
                    <Ionicons name="person" size={16} color="#999" />
                  </View>
                )}
              </View>
            ))}
          </View>

          <Text style={{ color: 'white', fontSize: 13, marginLeft: 8, fontWeight: '600' }}>
            {visit.user_count || 0}+
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export default VisitCard;