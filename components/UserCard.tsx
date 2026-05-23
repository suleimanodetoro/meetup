// components/UserCard.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UserCardProps {
  user: {
    user_id: string;
    full_name: string;
    avatar_url?: string;
    bio?: string;
    nationality_code?: string;
    is_verified: boolean;
    visit_start: string;
    visit_end: string;
  };
}

function formatVisitWindow(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const parse = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00`);
  const s = parse(start);
  const e = parse(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = s.toLocaleDateString('en-US', opts);
  if (s.getTime() === e.getTime()) return startStr;
  const endStr = e.toLocaleDateString('en-US', opts);
  return `${startStr} – ${endStr}`;
}

export default function UserCard({ user }: UserCardProps) {
  const window = formatVisitWindow(user.visit_start, user.visit_end);

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
              <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {user.full_name}
            </Text>
            {window && <Text style={styles.window} numberOfLines={1}>{window}</Text>}
          </View>

          {user.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
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
  window: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
    flexShrink: 0,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
});