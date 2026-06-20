// app/friends.tsx
// "See all" for the profile's friends rail: a performant, full-width list of the
// signed-in user's accepted friends. Tapping a row opens that profile.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppImage } from '~/components/AppImage';
import { InitialsAvatar } from '~/components/InitialsAvatar';
import { GradientButton } from '~/components/GradientButton';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { getCountryFlag } from '~/utils/countryFlags';
import { authColors, authSpace } from '~/utils/authTheme';
import { display } from '~/utils/fonts';

type Friend = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  location?: string | null;
  location_country?: string | null;
  location_country_code?: string | null;
  nationality?: string | null;
  nationality_code?: string | null;
};

const FRIEND_COLS =
  'id, full_name, avatar_url, location, location_country, location_country_code, nationality, nationality_code';

export default function FriendsScreen() {
  const { session } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFriends = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    // Accepted friendships in either direction; keep the "other" side of each.
    const { data } = await supabase
      .from('friendships')
      .select(
        `requester:profiles!friendships_requester_id_fkey(${FRIEND_COLS}),
         addressee:profiles!friendships_addressee_id_fkey(${FRIEND_COLS})`
      )
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .eq('status', 'accepted')
      .limit(200);

    const list = ((data as any[]) || [])
      .map((row) => (row.requester?.id === uid ? row.addressee : row.requester))
      .filter(Boolean) as Friend[];
    setFriends(list);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchFriends().finally(() => setLoading(false));
  }, [fetchFriends]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFriends().finally(() => setRefreshing(false));
  }, [fetchFriends]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={authColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={authColors.accent} />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={friends.length === 0 ? styles.emptyContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <FriendRow friend={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={authColors.textTertiary} />
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyBody}>
                Find people doing sidequests near you and add them to your crew.
              </Text>
              <GradientButton
                label="Find people"
                onPress={() => router.push('/search-users')}
                style={{ alignSelf: 'center' }}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const code = friend.location_country_code || friend.nationality_code || '';
  const place =
    [friend.location, friend.location_country].filter(Boolean).join(', ') ||
    friend.nationality ||
    '';

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/profile/${friend.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open profile ${friend.full_name ?? ''}`}>
      {friend.avatar_url ? (
        <AppImage source={{ uri: friend.avatar_url }} style={styles.avatar} />
      ) : (
        <InitialsAvatar name={friend.full_name || ''} id={friend.id} size={52} />
      )}
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {friend.full_name || 'Waypointer'}
        </Text>
        {place ? (
          <Text style={styles.sub} numberOfLines={1}>
            {getCountryFlag(code)} {place}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={authColors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: authColors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.md,
  },
  backButton: { width: 36, justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: display('700'),
    fontSize: 18,
    fontWeight: '700',
    color: authColors.textPrimary,
  },
  headerSpacer: { width: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: authSpace.xl, paddingBottom: 40, paddingTop: authSpace.sm },
  emptyContent: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: authSpace.md,
    gap: authSpace.lg,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: authColors.borderMuted },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: authColors.textPrimary },
  sub: { marginTop: 2, fontSize: 14, color: authColors.textSecondary },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: authSpace.xl,
    gap: authSpace.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: authColors.textPrimary,
    marginTop: authSpace.sm,
  },
  emptyBody: { fontSize: 15, color: authColors.textSecondary, textAlign: 'center', lineHeight: 21 },
  cta: {
    marginTop: authSpace.md,
    backgroundColor: authColors.ctaPrimaryBg,
    paddingHorizontal: authSpace.xl,
    paddingVertical: authSpace.md,
    borderRadius: 30,
  },
  ctaText: { color: authColors.ctaPrimaryText, fontSize: 15, fontWeight: '600' },
});
