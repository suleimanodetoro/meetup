// app/(tabs)/index.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Pressable,
  Image,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { useSubscription } from '~/hooks/useSubscription';
import { getCityImageUrl } from '~/utils/cityImages';
import type { Event } from '~/types/db';
import { PremiumBadge } from '~/components/PremiumBadge';
import PrimaryButton from '~/components/auth/PrimaryButton';
import { authColors, authHitSlop, authRadius, authSpace, authType } from '~/utils/authTheme';

// Import components
import { VisitCard } from '~/components/VisitCard';
import PlanCardHome from '~/components/PlanCardHome';
import { PersonCard } from '~/components/PersonCard';

export default function HomeScreen() {
  const { session } = useAuth();
  const { hasSubscription } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [trendingVisits, setTrendingVisits] = useState<any[]>([]);
  const [popularPlans, setPopularPlans] = useState<any[]>([]);
  const [newPlans, setNewPlans] = useState<any[]>([]);
  const [suggestedPeople, setSuggestedPeople] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchHomeData = useCallback(async () => {
    try {
      // Fetch user profile FIRST
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) setUserProfile(profile);
      }

      // Trending visits
      const { data: visits, error: visitsError } = await supabase.rpc('get_trending_visits');
      if (visitsError) throw visitsError;

      const visitsWithImages = (visits || []).map((visit) => ({
        ...visit,
        image_url: getCityImageUrl(visit.city),
      }));

      setTrendingVisits(visitsWithImages.slice(0, 6));

      // Popular plans
      const { data: popular, error: popularError } = await supabase.rpc(
        'get_popular_plans_with_attendees'
      );
      if (popularError) throw popularError;
      setPopularPlans((popular || []).slice(0, 6));

      // New plans
      const { data: recent, error: recentError } = await supabase.rpc('get_new_plans');
      if (recentError) throw recentError;
      setNewPlans((recent || []).slice(0, 6));

      // Suggested users - Function now ALWAYS returns up to 7 users
      if (session?.user?.id) {
        const { data: people, error: peopleError } = await supabase.rpc('get_suggested_users', {
          current_user_id: session.user.id,
        });
        if (peopleError) {
          console.error('Error fetching suggested users:', peopleError);
        } else if (people) {
          setSuggestedPeople(people); // Function already returns 7 max, no need to slice
        }
      }
    } catch (err) {
      console.error('Error fetching home data:', err);
      Alert.alert('Error', 'Failed to load content. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHomeData();
  }, [fetchHomeData]);

  const hasFeedContent =
    trendingVisits.length > 0 ||
    popularPlans.length > 0 ||
    newPlans.length > 0 ||
    suggestedPeople.length > 0;

  const getVisitKey = useCallback((visit: any) => {
    const c = visit.city ?? 'city';
    const s = visit.start_date ?? 'start';
    const e = visit.end_date ?? 'end';
    return `visit-${c}-${s}-${e}-${visit.id ?? 'id'}`;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={authColors.accent} />
          <Text style={styles.loadingTitle}>Finding your next waypoint</Text>
          <Text style={styles.loadingText}>Trips, plans, and people are loading.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <View style={styles.brandRow}>
              <View style={styles.logoWrap}>
                <Image
                  source={require('../../assets/ios-light.png')}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.brandTitle}>Waypoint</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={authHitSlop}
              style={styles.avatarButton}>
              <View style={styles.avatar}>
                {userProfile?.avatar_url ? (
                  <Image
                    source={{ uri: userProfile.avatar_url }}
                    style={styles.avatarImage}
                    onError={() => {}}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={20} color={authColors.textTertiary} />
                  </View>
                )}
              </View>
              {hasSubscription && (
                <PremiumBadge size={14} style={{ position: 'absolute', bottom: -3, right: -3 }} />
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.push('/search')}
            accessibilityRole="button"
            hitSlop={authHitSlop}
            style={styles.searchBox}>
            <Ionicons name="search" size={20} color={authColors.textTertiary} />
            <Text style={styles.searchText}>Search a city or date range</Text>
          </Pressable>
        </View>

        {trendingVisits.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Trending trips" subtitle="Popular among users" />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={trendingVisits}
              keyExtractor={getVisitKey}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => <VisitCard visit={item} />}
            />
          </View>
        )}

        {popularPlans.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Popular plans"
              subtitle="High-signal meetups with other travelers"
              actionLabel="See more"
              onAction={() => router.push('/explore?filter=popular')}
            />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={popularPlans}
              keyExtractor={(item) => `popular-${item.id}`}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => (
                <PlanCardHome
                  plan={item as Event & { attendee_count?: number; recent_attendees?: any[] }}
                />
              )}
            />
          </View>
        )}

        {newPlans.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Fresh plans"
              subtitle="Be one of the first to join"
              actionLabel="See more"
              onAction={() => router.push('/explore?filter=new')}
            />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={newPlans}
              keyExtractor={(item) => `new-${item.id}`}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => (
                <PlanCardHome
                  plan={item as Event & { attendee_count?: number; recent_attendees?: any[] }}
                />
              )}
            />
          </View>
        )}

        {suggestedPeople.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="People you may like"
              subtitle="Travelers with overlapping plans and interests"
              actionLabel="Find more"
              onAction={() => router.push('/search-users')}
            />
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={suggestedPeople}
              keyExtractor={(person) => `person-${person.id}`}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => <PersonCard person={item} />}
            />
          </View>
        )}

        {!hasFeedContent && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="compass-outline" size={30} color={authColors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No trips or plans yet</Text>
            <Text style={styles.emptyText}>
              Start the feed by creating a plan or adding the trip you already have coming up.
            </Text>
            <View style={styles.emptyActions}>
              <PrimaryButton
                label="Create a plan"
                onPress={() => router.push('/create-plan/name')}
                leftIcon={<Ionicons name="add" size={20} color={authColors.ctaPrimaryText} />}
              />
              <Pressable
                onPress={() => router.push('/add-trip')}
                accessibilityRole="button"
                hitSlop={authHitSlop}
                style={styles.secondaryTextButton}>
                <Text style={styles.secondaryTextButtonLabel}>Add an upcoming trip</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
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
    alignItems: 'center',
    justifyContent: 'center',
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
  header: {
    paddingHorizontal: authSpace.xl,
    paddingTop: authSpace.lg,
    paddingBottom: authSpace.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: authSpace.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: authColors.accentSoft,
    marginRight: authSpace.md,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    color: authColors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  avatarButton: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: authColors.borderMuted,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: authRadius.input,
    paddingHorizontal: authSpace.lg,
    paddingVertical: authSpace.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchText: {
    marginLeft: authSpace.sm,
    color: authColors.textTertiary,
    fontSize: 15,
    flex: 1,
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
  sectionHeaderText: {
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
    marginTop: authSpace.xxl,
    padding: authSpace.xl,
    alignItems: 'center',
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    borderRadius: 24,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: authColors.accentSoft,
    marginBottom: authSpace.lg,
  },
  emptyTitle: {
    color: authColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: authSpace.sm,
    color: authColors.textSecondary,
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: authSpace.xl,
    width: '100%',
    gap: authSpace.md,
  },
  secondaryTextButton: {
    alignItems: 'center',
    paddingVertical: authSpace.sm,
  },
  secondaryTextButtonLabel: {
    color: authColors.accent,
    fontSize: authType.link.fontSize,
    fontWeight: '700',
  },
});
