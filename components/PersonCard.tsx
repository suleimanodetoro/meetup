// components/PersonCard.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { AppImage } from '~/components/AppImage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCountryFlag } from '~/utils/countryFlags';
import { PremiumBadge } from './PremiumBadge';
import { authColors } from '~/utils/authTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PersonCardProps {
  person: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    birth_date?: string | Date;
    nationality_code?: string;
    location?: string;
    location_country_code?: string | null;
    is_online?: boolean; // TODO: Implement presence
    is_premium?: boolean;
  };
}

export const PersonCard = React.memo<PersonCardProps>(({ person }) => {
  const [imageError, setImageError] = useState(false);
  const displayCountryCode = person.location_country_code ?? person.nationality_code;

  // Reset image error when avatar changes
  useEffect(() => {
    setImageError(false);
  }, [person.avatar_url]);

  const age = useMemo(() => {
    if (!person.birth_date) return null;
    try {
      const birth = new Date(person.birth_date);
      if (isNaN(birth.getTime())) return null;

      const today = new Date();
      let a = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;

      // Sanity bounds
      return a >= 0 && a < 120 ? a : null;
    } catch {
      return null;
    }
  }, [person.birth_date]);

  return (
    <Pressable
      onPress={() => router.push(`/profile/${person.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open profile ${person.full_name ?? 'Profile'}`}
      hitSlop={8}
      style={{
        width: (SCREEN_WIDTH - 48) / 3,
        marginRight: 12,
      }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 0.75,
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 8,
          backgroundColor: authColors.borderMuted,
        }}>
        {person.avatar_url && !imageError ? (
          <AppImage
            source={{ uri: person.avatar_url }}
            style={{ width: '100%', height: '100%' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Ionicons name="person" size={40} color={authColors.textTertiary} />
          </View>
        )}

        {/* Country flag overlay */}
        {!!displayCountryCode && (
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: authColors.surface,
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 12,
            }}>
            <Text style={{ fontSize: 16 }}>{getCountryFlag(displayCountryCode)}</Text>
          </View>
        )}

        {/* Presence indicator — enable when real presence exists
        {person.is_online && (
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: '#4CAF50',
              borderWidth: 2,
              borderColor: 'white',
            }}
          />
        )}
        */}

        {person.is_premium && (
          <PremiumBadge size={18} style={{ position: 'absolute', bottom: 8, right: 8 }} />
        )}
      </View>

      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          marginBottom: 2,
          color: authColors.textPrimary,
        }}
        numberOfLines={1}>
        {person.full_name || 'User'}
      </Text>

      {typeof age === 'number' && (
        <Text style={{ fontSize: 13, color: authColors.textSecondary }}>{age} years old</Text>
      )}

      {!!person.location && (
        <Text style={{ fontSize: 12, color: authColors.textTertiary }} numberOfLines={1}>
          {person.location}
        </Text>
      )}
    </Pressable>
  );
});

export default PersonCard;
