// components/UserCard.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCountryFlag } from '~/utils/countryFlags';

interface UserCardProps {
  user: {
    user_id: string;
    full_name: string;
    avatar_url?: string;
    bio?: string;
    nationality_code?: string;
    is_verified: boolean;
    overlap_days: number;
    visit_start: string;
    visit_end: string;
  };
}

export default function UserCard({ user }: UserCardProps) {
  const getMatchBadge = () => {
    if (user.overlap_days >= 5) {
      return { text: `${user.overlap_days} days match!`, color: '#4CAF50' };
    } else if (user.overlap_days >= 3) {
      return { text: `${user.overlap_days} days match`, color: '#FF9800' };
    } else if (user.overlap_days > 0) {
      return { text: `${user.overlap_days} day${user.overlap_days > 1 ? 's' : ''} overlap`, color: '#2196F3' };
    }
    return null;
  };

  const badge = getMatchBadge();

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <View style={styles.avatarContainer}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {user.full_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {user.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4A90E2" />
            </View>
          )}
        </View>
        
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {user.full_name}
            </Text>
            {user.nationality_code && (
              <Text style={styles.flag}>{getCountryFlag(user.nationality_code)}</Text>
            )}
          </View>
          
          {user.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
          )}
          
          {badge && (
            <View style={[styles.badge, { backgroundColor: `${badge.color}20` }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>
                {badge.text}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#C0C0C0" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  flag: {
    fontSize: 16,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});