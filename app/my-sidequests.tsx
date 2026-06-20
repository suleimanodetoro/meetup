// app/my-sidequests.tsx
// "See all" for the profile's sidequests rail: a performant, full-width list of
// the sidequests the signed-in user is part of — ones they joined (attendance)
// and ones they created (host) — merged and de-duped. Tapping opens the quest.
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
import { GradientButton } from '~/components/GradientButton';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { getCityImageUrl } from '~/utils/cityImages';
import { authColors, authSpace } from '~/utils/authTheme';
import { display } from '~/utils/fonts';

type Quest = {
  id: number;
  title: string | null;
  city: string | null;
  location_name: string | null;
  image_uri: string | null;
  date: string | null;
};

const EVENT_COLS = 'id, title, city, location_name, image_uri, date';

function formatDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MySidequestsScreen() {
  const { session } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuests = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;

    const [joinedRes, createdRes] = await Promise.all([
      supabase
        .from('attendance')
        .select(`event_id, events (${EVENT_COLS})`)
        .eq('user_id', uid)
        .limit(100),
      supabase
        .from('events')
        .select(EVENT_COLS)
        .eq('user_id', uid)
        .order('date', { ascending: false })
        .limit(100),
    ]);

    const joined = ((joinedRes.data as any[]) || []).map((row) => row.events).filter(Boolean);
    const created = (createdRes.data as any[]) || [];

    // Created first so the user's own sidequests lead the list; de-dupe by id.
    const byId = new Map<number, Quest>();
    for (const q of [...created, ...joined]) {
      if (q && !byId.has(q.id)) byId.set(q.id, q);
    }
    setQuests(Array.from(byId.values()));
  }, [session?.user?.id]);

  useEffect(() => {
    fetchQuests().finally(() => setLoading(false));
  }, [fetchQuests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchQuests().finally(() => setRefreshing(false));
  }, [fetchQuests]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={28} color={authColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Your sidequests</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={authColors.accent} />
        </View>
      ) : (
        <FlatList
          data={quests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={quests.length === 0 ? styles.emptyContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <QuestRow quest={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="compass-outline" size={40} color={authColors.textTertiary} />
              <Text style={styles.emptyTitle}>No sidequests yet</Text>
              <Text style={styles.emptyBody}>
                Start one solo, dare a friend, or join people near you.
              </Text>
              <GradientButton
                label="Start a sidequest"
                onPress={() => router.push('/create-plan/intent' as never)}
                style={{ alignSelf: 'center' }}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  const when = formatDate(quest.date);
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/event/${quest.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${quest.title ?? 'sidequest'}`}>
      <AppImage
        source={{ uri: quest.image_uri || getCityImageUrl(quest.city || '') }}
        style={styles.thumb}
      />
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {quest.title || 'Sidequest'}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          📍 {quest.location_name || quest.city || 'Somewhere'}
        </Text>
        {when ? <Text style={styles.date}>{when}</Text> : null}
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
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: authColors.borderMuted },
  rowText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: authColors.textPrimary },
  sub: { marginTop: 2, fontSize: 14, color: authColors.textSecondary },
  date: { marginTop: 2, fontSize: 13, color: authColors.accent, fontWeight: '500' },
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
