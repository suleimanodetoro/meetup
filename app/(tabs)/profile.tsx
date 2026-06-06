// app/(tabs)/profile.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { PersonCard } from '~/components/PersonCard';
import PlanCardHome from '~/components/PlanCardHome';
import { PremiumBadge } from '~/components/PremiumBadge';
import PrimaryButton from '~/components/auth/PrimaryButton';
import { VisitCard } from '~/components/VisitCard';
import { useAuth } from '~/contexts/AuthProvider';
import { useSubscription } from '~/hooks/useSubscription';
import type { Profile } from '~/types/db';
import { getCountryFlag } from '~/utils/countryFlags';
import { INTERESTS, LANGUAGES } from '~/utils/constants';
import { supabase } from '~/utils/supabase';
import { authColors, authHitSlop, authSpace, authType } from '~/utils/authTheme';

const LANGUAGE_BY_CODE = new Map<string, (typeof LANGUAGES)[number]>(
  LANGUAGES.map((language) => [language.code, language])
);

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [value];
  } catch {
    return [value];
  }
}

function formatLanguages(codes: readonly string[]): string {
  return codes.map((code) => LANGUAGE_BY_CODE.get(code)?.name ?? code).join(', ');
}

function getInterestLabel(interestId: string): string {
  return INTERESTS.find((interest) => interest.id === interestId)?.label ?? interestId;
}

export default function ProfileScreen() {
  const { session } = useAuth();
  const { hasSubscription } = useSubscription();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [joinedPlans, setJoinedPlans] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [stats, setStats] = useState({
    totalTrips: 0,
    countriesVisited: 0,
    plansCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [session]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, []);

  const fetchAll = async () => {
    if (!session?.user?.id) return;
    try {
      await Promise.all([
        fetchProfile(),
        fetchStats(),
        fetchUpcomingVisits(),
        fetchJoinedPlans(),
        fetchFriends(),
        fetchPendingRequestsCount(),
      ]);
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchProfile = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) setProfile(data);
  };

  const fetchStats = async () => {
    if (!session?.user?.id) return;

    const { data: visitsData } = await supabase
      .from('visits')
      .select('city, country')
      .eq('user_id', session.user.id);

    const uniqueCountries = new Set(visitsData?.map((visit) => visit.country) || []);

    const { count: plansCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    setStats({
      totalTrips: visitsData?.length || 0,
      countriesVisited: uniqueCountries.size,
      plansCount: plansCount || 0,
    });
  };

  const fetchUpcomingVisits = async () => {
    if (!session?.user?.id) return;
    const now = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('visits')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('start_date', now)
      .order('start_date', { ascending: true })
      .limit(10);
    setUpcomingVisits(data || []);
  };

  const fetchJoinedPlans = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('attendance')
      .select(
        `
        event_id,
        events (
          id,
          title,
          description,
          date,
          end_date,
          city,
          image_uri,
          attendance (user_id, profiles (id, full_name, avatar_url))
        )
      `
      )
      .eq('user_id', session.user.id)
      .limit(10);

    const plans = (data || []).map((plan) => plan.events).filter(Boolean);
    setJoinedPlans(plans as any);
  };

  const fetchFriends = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(
          `
        id,
        requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, birth_date, nationality, nationality_code, location, location_country_code),
        addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, birth_date, nationality, nationality_code, location, location_country_code)
      `
        )
        .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`)
        .eq('status', 'accepted')
        .limit(6);

      if (error) {
        console.error('Error fetching friends:', error);
        return;
      }

      const friendsList = (data || [])
        .map((friendship) =>
          friendship.requester?.id === session.user.id ? friendship.addressee : friendship.requester
        )
        .filter(Boolean);

      setFriends(friendsList);
    } catch (error) {
      console.error('Error in fetchFriends:', error);
    }
  };

  const fetchPendingRequestsCount = async () => {
    if (!session?.user?.id) return;

    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', session.user.id)
      .eq('status', 'pending');

    setPendingRequestsCount(count || 0);
  };

  const interests = useMemo(
    () => asStringArray(profile?.interests).slice(0, 6),
    [profile?.interests]
  );
  const languages = useMemo(() => asStringArray(profile?.languages), [profile?.languages]);
  const locationLabel = profile?.location || profile?.nationality || 'Add your location';
  const countryCode = profile?.location_country_code || profile?.nationality_code || 'US';
  const initials = (profile?.full_name?.[0] || 'W').toUpperCase();

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={authColors.accent} />
          <Text style={styles.loadingTitle}>Opening your profile</Text>
          <Text style={styles.loadingText}>Pulling together your trips, plans, and people.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.screenHeader}>
          <View>
            <Text style={styles.screenEyebrow}>Your space</Text>
            <Text style={styles.screenTitle}>Profile</Text>
          </View>

          <View style={styles.headerActions}>
            <IconButton
              icon="create-outline"
              label="Edit profile"
              onPress={() => router.push('/edit-profile')}
            />
            <IconButton
              icon="notifications-outline"
              label="Friend requests"
              badge={pendingRequestsCount}
              onPress={() => router.push('/friend-requests')}
            />
            <IconButton
              icon="settings-outline"
              label="Settings"
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.avatarShell}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.heroAvatar} />
              ) : (
                <Text style={styles.avatarInitial}>{initials}</Text>
              )}
              {hasSubscription && <PremiumBadge size={24} style={styles.heroPremiumBadge} />}
            </View>

            <View style={styles.heroText}>
              <Text style={styles.profileName}>{profile?.full_name || 'Traveler'}</Text>
              <View style={styles.locationRow}>
                <Text style={styles.locationFlag}>{getCountryFlag(countryCode)}</Text>
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationLabel}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.bioText, !profile?.bio && styles.bioPlaceholder]}>
            {profile?.bio ||
              'Add a short bio so other travelers know what kind of plans you like joining.'}
          </Text>

          <View style={styles.heroActions}>
            <Pressable
              onPress={() => router.push('/edit-profile')}
              accessibilityRole="button"
              hitSlop={authHitSlop}
              style={styles.heroPrimaryAction}>
              <Ionicons name="sparkles-outline" size={18} color={authColors.ctaPrimaryText} />
              <Text style={styles.heroPrimaryActionText}>Polish profile</Text>
            </Pressable>
            {session?.user?.id ? (
              <Pressable
                onPress={() => router.push(`/profile/${session.user.id}`)}
                accessibilityRole="button"
                hitSlop={authHitSlop}
                style={styles.heroSecondaryAction}>
                <Ionicons name="eye-outline" size={18} color={authColors.accent} />
                <Text style={styles.heroSecondaryActionText}>Preview</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBox value={stats.plansCount} label="Plans" icon="calendar-outline" />
          <StatBox value={stats.totalTrips} label="Trips" icon="airplane-outline" />
          <StatBox value={stats.countriesVisited} label="Countries" icon="earth-outline" />
        </View>

        {(interests.length > 0 || languages.length > 0) && (
          <View style={styles.identityCard}>
            {interests.length > 0 && (
              <View style={styles.identityBlock}>
                <Text style={styles.identityLabel}>Interests</Text>
                <View style={styles.chipWrap}>
                  {interests.map((interest) => (
                    <View key={interest} style={styles.chip}>
                      <Text style={styles.chipText}>{getInterestLabel(interest)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {languages.length > 0 && (
              <View style={styles.identityBlock}>
                <Text style={styles.identityLabel}>Languages</Text>
                <View style={styles.languagePill}>
                  <Text style={styles.languageIcon}>aA</Text>
                  <Text style={styles.languageText} numberOfLines={2}>
                    {formatLanguages(languages)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <ProfileSection title="Upcoming trips" subtitle="Where your next travel overlap can start">
          {upcomingVisits.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={upcomingVisits}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => <VisitCard visit={item} />}
            />
          ) : (
            <EmptyState
              icon="airplane-outline"
              title="No upcoming trips yet"
              body="Add a trip so Waypoint can show people and plans nearby."
              actionLabel="Add a trip"
              onAction={() => router.push('/add-trip')}
            />
          )}
        </ProfileSection>

        <ProfileSection
          title="Plans you joined"
          subtitle="Meetups and moments already on your radar"
          actionLabel="Explore"
          onAction={() => router.push('/explore')}>
          {joinedPlans.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={joinedPlans}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => <PlanCardHome plan={item} />}
            />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="No joined plans yet"
              body="Explore what travelers are hosting and join something that fits your vibe."
              actionLabel="Find plans"
              onAction={() => router.push('/explore')}
            />
          )}
        </ProfileSection>

        <ProfileSection
          title="My friends"
          subtitle="Travelers you have connected with"
          actionLabel="Find more"
          onAction={() => router.push('/search-users')}>
          {friends.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={friends}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => <PersonCard person={item} />}
            />
          ) : (
            <EmptyState
              icon="people-outline"
              title="No friends yet"
              body="Start connecting with travelers before your next plan."
              actionLabel="Find travelers"
              onAction={() => router.push('/search-users')}
            />
          )}
        </ProfileSection>
      </ScrollView>
    </SafeAreaView>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  badge = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={authHitSlop}
      style={styles.iconButton}>
      <Ionicons name={icon} size={20} color={authColors.textPrimary} />
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function StatBox({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={authColors.accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProfileSection({
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            hitSlop={authHitSlop}
            style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={15} color={authColors.accent} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={authColors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      <View style={styles.emptyAction}>
        <PrimaryButton label={actionLabel} onPress={onAction} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  scrollContent: {
    paddingBottom: authSpace.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: authSpace.xl,
  },
  loadingTitle: {
    marginTop: authSpace.lg,
    color: authColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  loadingText: {
    marginTop: authSpace.xs,
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    textAlign: 'center',
  },
  screenHeader: {
    paddingHorizontal: authSpace.xl,
    paddingTop: authSpace.lg,
    paddingBottom: authSpace.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: authSpace.lg,
  },
  screenEyebrow: {
    color: authColors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  screenTitle: {
    color: authColors.textPrimary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    backgroundColor: authColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: authColors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: authColors.ctaPrimaryText,
    fontSize: 10,
    fontWeight: '800',
  },
  heroCard: {
    marginHorizontal: authSpace.xl,
    padding: authSpace.xl,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: authColors.accentBorder,
    backgroundColor: authColors.surfaceAlt,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.lg,
  },
  avatarShell: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: authColors.surface,
    borderWidth: 3,
    borderColor: authColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarInitial: {
    color: authColors.textPrimary,
    fontSize: 36,
    fontWeight: '800',
  },
  heroPremiumBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  heroText: {
    flex: 1,
  },
  profileName: {
    color: authColors.textPrimary,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  locationRow: {
    marginTop: authSpace.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.sm,
  },
  locationFlag: {
    fontSize: 18,
  },
  locationText: {
    flex: 1,
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
    fontWeight: '500',
  },
  bioText: {
    marginTop: authSpace.lg,
    color: authColors.textSecondary,
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
  },
  bioPlaceholder: {
    color: authColors.textTertiary,
  },
  heroActions: {
    marginTop: authSpace.xl,
    flexDirection: 'row',
    gap: authSpace.md,
  },
  heroPrimaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: authColors.ctaPrimaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: authSpace.sm,
  },
  heroPrimaryActionText: {
    color: authColors.ctaPrimaryText,
    fontSize: authType.link.fontSize,
    fontWeight: '700',
  },
  heroSecondaryAction: {
    minHeight: 48,
    paddingHorizontal: authSpace.lg,
    borderRadius: 24,
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: authSpace.sm,
  },
  heroSecondaryActionText: {
    color: authColors.accent,
    fontSize: authType.link.fontSize,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: authSpace.xl,
    gap: authSpace.md,
    marginTop: authSpace.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: authColors.surface,
    borderRadius: 18,
    paddingVertical: authSpace.lg,
    paddingHorizontal: authSpace.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: authColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: authSpace.sm,
  },
  statValue: {
    color: authColors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    marginTop: 2,
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
  },
  identityCard: {
    marginHorizontal: authSpace.xl,
    marginTop: authSpace.lg,
    padding: authSpace.lg,
    borderRadius: 22,
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    gap: authSpace.lg,
  },
  identityBlock: {
    gap: authSpace.sm,
  },
  identityLabel: {
    color: authColors.textPrimary,
    fontSize: authType.label.fontSize,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: authSpace.sm,
  },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    backgroundColor: authColors.surface,
    paddingHorizontal: authSpace.md,
    paddingVertical: authSpace.sm,
  },
  chipText: {
    color: authColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.accentBorder,
    backgroundColor: authColors.accentSoft,
    paddingHorizontal: authSpace.md,
    paddingVertical: authSpace.md,
  },
  languageIcon: {
    color: authColors.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  languageText: {
    flex: 1,
    color: authColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  section: {
    marginTop: authSpace.xxl,
  },
  sectionHeader: {
    paddingHorizontal: authSpace.xl,
    marginBottom: authSpace.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: authSpace.md,
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    color: authColors.textPrimary,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  sectionSubtitle: {
    marginTop: authSpace.xs,
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
    lineHeight: authType.disclaimer.lineHeight,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  sectionActionText: {
    color: authColors.accent,
    fontSize: authType.link.fontSize,
    fontWeight: '600',
  },
  carouselContent: {
    paddingHorizontal: authSpace.xl,
  },
  emptyCard: {
    marginHorizontal: authSpace.xl,
    padding: authSpace.xl,
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.accentSoft,
    marginBottom: authSpace.lg,
  },
  emptyTitle: {
    color: authColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: authSpace.sm,
    color: authColors.textSecondary,
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    textAlign: 'center',
  },
  emptyAction: {
    width: '100%',
    marginTop: authSpace.xl,
  },
});
