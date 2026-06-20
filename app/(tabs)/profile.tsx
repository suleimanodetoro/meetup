// app/(tabs)/profile.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppImage } from '~/components/AppImage';
import Mapbox, { Camera, MapView } from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { FounderBadge } from '~/components/FounderBadge';
import { PersonCard } from '~/components/PersonCard';
import PlanCardHome from '~/components/PlanCardHome';
import { PremiumBadge } from '~/components/PremiumBadge';
import { useAuth } from '~/contexts/AuthProvider';
import { useSubscription } from '~/hooks/useSubscription';
import type { Profile } from '~/types/db';
import { getCountryFlag } from '~/utils/countryFlags';
import { supabase } from '~/utils/supabase';
import { authColors, authHitSlop } from '~/utils/authTheme';
import { display } from '~/utils/fonts';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COUNTRIES_IN_WORLD = 202;

// The three profile "moments" are now three detents of a single flowing sheet:
//   index 0 → globe (collapsed)   1 → half (default)   2 → full profile
// The globe backdrop fades/recedes behind the sheet as it rises, driven off
// the sheet's own animatedIndex — no PanResponder, no mounted/unmounted modal.
const SNAP_POINTS = ['16%', '56%', '92%'];

const STARS = Array.from({ length: 62 }, (_, index) => ({
  id: index,
  left: ((index * 37) % 100) * 0.01 * SCREEN_WIDTH,
  top: (6 + ((index * 53) % 74)) * 0.01 * SCREEN_HEIGHT,
  size: 1 + (index % 3) * 0.7,
  opacity: 0.25 + (index % 5) * 0.13,
}));

// Pull the @handle out of a stored social URL for display.
function socialHandle(url?: string | null): string | null {
  if (!url) return null;
  const seg = url.replace(/\/+$/, '').split('/').pop() || '';
  return seg.replace(/^@/, '') || null;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { hasSubscription, isFounder } = useSubscription();

  const sheetRef = useRef<BottomSheet>(null);
  const animatedIndex = useSharedValue(1);
  const [statusBarStyle, setStatusBarStyle] = useState<'light-content' | 'dark-content'>(
    'light-content'
  );

  const [profile, setProfile] = useState<Profile | null>(null);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [joinedPlans, setJoinedPlans] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTrips: 0,
    countriesVisited: 0,
    plansCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Flip the status bar to dark once the white sheet has covered most of the
  // dark globe. useAnimatedReaction keeps this on the UI thread and only hops
  // to JS on an actual style change.
  useAnimatedReaction(
    () => animatedIndex.value,
    (value, previous) => {
      const next = value > 1.5 ? 'dark-content' : 'light-content';
      const prev = (previous ?? 1) > 1.5 ? 'dark-content' : 'light-content';
      if (next !== prev) runOnJS(setStatusBarStyle)(next);
    }
  );

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) setProfile(data);
  }, [session?.user?.id]);

  const fetchStats = useCallback(async () => {
    if (!session?.user?.id) return;

    const { data: visitsData } = await supabase
      .from('visits')
      .select('city, country')
      .eq('user_id', session.user.id);

    const uniqueCountries = new Set(
      (visitsData || []).map((visit) => visit.country).filter(Boolean)
    );

    const { count: plansCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    setStats({
      totalTrips: visitsData?.length || 0,
      countriesVisited: uniqueCountries.size,
      plansCount: plansCount || 0,
    });
  }, [session?.user?.id]);

  const fetchUpcomingVisits = useCallback(async () => {
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
  }, [session?.user?.id]);

  const fetchJoinedPlans = useCallback(async () => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    // A creator is a participant in their own sidequest, so "joined" covers
    // both: the ones I joined (attendance roster) AND the ones I created (host).
    // Merge + de-dupe by id. Created ones surface even if the attendance row is
    // missing (e.g. an interrupted creation).
    const eventCols = `
      id,
      title,
      description,
      date,
      end_date,
      city,
      location_name,
      image_uri,
      cost,
      cost_currency,
      attendance (user_id, profiles (id, full_name, avatar_url))
    `;

    const [joinedRes, createdRes] = await Promise.all([
      supabase
        .from('attendance')
        .select(`event_id, events (${eventCols})`)
        .eq('user_id', uid)
        .limit(20),
      supabase
        .from('events')
        .select(eventCols)
        .eq('user_id', uid)
        .order('date', { ascending: false })
        .limit(20),
    ]);

    const joined = ((joinedRes.data as any[]) || []).map((row) => row.events).filter(Boolean);
    const created = (createdRes.data as any[]) || [];

    // Created first so the user's own sidequests lead the list.
    const byId = new Map<number, any>();
    for (const plan of [...created, ...joined]) {
      if (plan && !byId.has(plan.id)) byId.set(plan.id, plan);
    }
    setJoinedPlans(Array.from(byId.values()).slice(0, 10) as any);
  }, [session?.user?.id]);

  const fetchFriends = useCallback(async () => {
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
  }, [session?.user?.id]);

  const fetchAll = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      await Promise.all([
        fetchProfile(),
        fetchStats(),
        fetchUpcomingVisits(),
        fetchJoinedPlans(),
        fetchFriends(),
      ]);
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  }, [
    fetchFriends,
    fetchJoinedPlans,
    fetchProfile,
    fetchStats,
    fetchUpcomingVisits,
    session?.user?.id,
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const countryCode = profile?.location_country_code || profile?.nationality_code || 'GB';
  const countryLabel = profile?.location_country || profile?.nationality || 'United Kingdom';
  const initials = (profile?.full_name?.[0] || 'W').toUpperCase();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Traveler';
  const groupCount = joinedPlans.length || stats.plansCount;
  const tripCount = upcomingVisits.length;
  const visitedCount = Math.max(stats.countriesVisited, 0);
  const worldPercent = Math.round((visitedCount / COUNTRIES_IN_WORLD) * 100);
  const bottomInset = Math.max(insets.bottom, 12);

  const profileData = useMemo(
    () => ({
      avatarUrl: profile?.avatar_url,
      initials,
      firstName,
      countryCode,
      countryLabel,
      bio: profile?.bio,
      groupCount,
      tripCount,
      visitedCount,
      worldPercent,
      isFounder,
      hasSubscription,
      joinedPlans,
      friends,
      instagramUrl: profile?.instagram_url,
      tiktokUrl: profile?.tiktok_url,
      youtubeUrl: profile?.youtube_url,
    }),
    [
      countryCode,
      countryLabel,
      firstName,
      friends,
      groupCount,
      hasSubscription,
      initials,
      isFounder,
      joinedPlans,
      profile?.avatar_url,
      profile?.bio,
      profile?.instagram_url,
      profile?.tiktok_url,
      profile?.youtube_url,
      tripCount,
      visitedCount,
      worldPercent,
    ]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={authColors.accent} />
        <Text style={styles.loadingTitle}>Opening your profile</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={statusBarStyle} />

      <GlobeBackdrop profile={profileData} animatedIndex={animatedIndex} />

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={SNAP_POINTS}
        animatedIndex={animatedIndex}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        enableOverDrag
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandleIndicator}>
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomInset + 96 }]}>
          <ProfileSheetBody profile={profileData} />
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Persistent floating controls — sit above every detent. */}
      <FloatingHeader topInset={insets.top} />
    </View>
  );
}

type ProfilePageData = {
  avatarUrl?: string | null;
  initials: string;
  firstName: string;
  countryCode: string;
  countryLabel: string;
  bio?: string | null;
  groupCount: number;
  tripCount: number;
  visitedCount: number;
  worldPercent: number;
  isFounder: boolean;
  hasSubscription: boolean;
  joinedPlans: any[];
  friends: any[];
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
};

/**
 * The space / globe experience that lives behind the sheet. Its globe recedes
 * and fades as the sheet climbs toward full, and the collapsed-only extras
 * (world stats + action buttons) fade out the moment the sheet leaves the
 * lowest detent so they never clip through the sheet's rounded top.
 */
function GlobeBackdrop({
  profile,
  animatedIndex,
}: {
  profile: ProfilePageData;
  animatedIndex: Animated.SharedValue<number>;
}) {
  const globeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [1, 1.9], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(animatedIndex.value, [1, 2], [0, -64], Extrapolation.CLAMP) },
      { scale: interpolate(animatedIndex.value, [1, 2], [1, 0.82], Extrapolation.CLAMP) },
    ],
  }));

  const collapsedExtrasStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 0.85], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.backdrop}>
      <SpaceBackground />

      <Animated.View style={[StyleSheet.absoluteFill, globeStyle]} pointerEvents="none">
        <View style={styles.realGlobePosition}>
          <RealMapboxGlobe />
        </View>
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, collapsedExtrasStyle]}
        pointerEvents="box-none">
        <View style={styles.worldStatsRow}>
          <View style={styles.worldStat}>
            <Text style={styles.worldStatValue}>
              {profile.visitedCount}{' '}
              <Text style={styles.worldStatMuted}>/ {COUNTRIES_IN_WORLD}</Text>
            </Text>
            <Text style={styles.worldStatLabel}>countries been</Text>
          </View>
          <View style={styles.worldDivider} />
          <View style={styles.worldStat}>
            <Text style={styles.worldStatValue}>{profile.worldPercent}%</Text>
            <Text style={styles.worldStatLabel}>of the world</Text>
          </View>
        </View>

        <View style={styles.globeActions}>
          <Pressable
            style={[styles.globeAction, styles.addCountryButton]}
            onPress={() => router.push('/add-trip')}>
            <Ionicons name="add" size={23} color="#FFFFFF" />
            <Text style={styles.globeActionText}>Add Country</Text>
          </Pressable>
          <Pressable
            style={[styles.globeAction, styles.editStyleButton]}
            onPress={() => router.push('/edit-profile')}>
            <Ionicons name="color-palette" size={22} color="#FFFFFF" />
            <Text style={styles.globeActionText}>Edit Style</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function FloatingHeader({ topInset }: { topInset: number }) {
  return (
    <View style={[styles.floatingHeader, { top: topInset + 18 }]} pointerEvents="box-none">
      <Pressable style={styles.glassButton} hitSlop={authHitSlop} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </Pressable>
      <Pressable
        style={styles.glassButton}
        hitSlop={authHitSlop}
        onPress={() => router.push('/settings')}>
        <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

/**
 * The single source of profile content. The sheet height decides how much of
 * it is revealed: avatar + stats peek at the collapsed detent, name/bio/groups
 * at half, and the whole thing (incl. Friends) scrolls at full.
 */
function ProfileSheetBody({ profile }: { profile: ProfilePageData }) {
  const { session } = useAuth();
  return (
    <>
      <View style={styles.sheetIdentityRow}>
        <Pressable
          onPress={() =>
            session?.user?.id && router.push(`/profile/${session.user.id}?preview=1` as never)
          }
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Preview your profile as others see it">
          <Avatar avatarUrl={profile.avatarUrl} initials={profile.initials} size={80} />
        </Pressable>
        <StatsStrip profile={profile} style={styles.sheetStatsStrip} />
      </View>

      <View style={styles.expandedNameRow}>
        <View style={styles.expandedNameLeft}>
          <View style={styles.nameBadgeRow}>
            <Text style={styles.expandedName}>{profile.firstName}</Text>
            <VerificationBadge profile={profile} />
          </View>
          <View style={styles.locationRow}>
            <Text style={styles.flagText}>{getCountryFlag(profile.countryCode)}</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {profile.countryLabel}
            </Text>
          </View>
        </View>
        <Pressable style={styles.editProfileLink} onPress={() => router.push('/edit-profile')}>
          <Text style={styles.editProfileText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color="#111111" />
        </Pressable>
      </View>

      <Text style={styles.bioText}>
        {profile.bio || 'Add a short bio so people know the kind of sidequests you like.'}
      </Text>

      {/* Socials — always shown; each platform shows its handle or "Not set" */}
      <ProfileSection
        title="Socials"
        actionLabel="Edit"
        onAction={() => router.push('/edit-profile')}>
        <View style={styles.socialsRow}>
          <View style={styles.socialPill}>
            <Ionicons name="logo-instagram" size={18} color={authColors.textPrimary} />
            <Text style={styles.socialText}>{socialHandle(profile.instagramUrl) || 'Not set'}</Text>
          </View>
          <View style={styles.socialPill}>
            <Ionicons name="logo-tiktok" size={18} color={authColors.textPrimary} />
            <Text style={styles.socialText}>{socialHandle(profile.tiktokUrl) || 'Not set'}</Text>
          </View>
          <View style={styles.socialPill}>
            <Ionicons name="logo-youtube" size={18} color={authColors.textPrimary} />
            <Text style={styles.socialText}>{socialHandle(profile.youtubeUrl) || 'Not set'}</Text>
          </View>
        </View>
      </ProfileSection>

      <ProfileSection
        title="Sidequests you've joined"
        actionLabel="See all"
        onAction={() => router.push('/explore')}>
        <GroupsContent groups={profile.joinedPlans} />
      </ProfileSection>

      <ProfileSection
        title="My Friends"
        actionLabel="See all"
        onAction={() => router.push('/search-users')}>
        <FriendsContent friends={profile.friends} />
      </ProfileSection>
    </>
  );
}

const RealMapboxGlobe = React.memo(function RealMapboxGlobe() {
  return (
    <View style={styles.globeFrame}>
      <View style={styles.globeGlow} />
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={Mapbox.StyleURL.SatelliteStreet}
        projection="globe"
        zoomEnabled={false}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}>
        <Camera
          centerCoordinate={[-58, 10]}
          zoomLevel={1.18}
          pitch={0}
          heading={0}
          animationMode="none"
        />
      </MapView>
    </View>
  );
});

function StatsStrip({ profile, style }: { profile: ProfilePageData; style?: any }) {
  return (
    <View style={[styles.statsStrip, style]}>
      <MiniStat value={profile.groupCount} label="Groups" />
      <MiniStat value={profile.tripCount} label="Trips" />
      <MiniStat value={profile.visitedCount} label="Visited" />
    </View>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function Avatar({
  avatarUrl,
  initials,
  size,
}: {
  avatarUrl?: string | null;
  initials: string;
  size: number;
}) {
  return (
    <View style={[styles.avatarShell, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatarUrl ? (
        <AppImage
          source={{ uri: avatarUrl }}
          style={[styles.avatarImage, { borderRadius: size / 2 }]}
        />
      ) : (
        <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>{initials}</Text>
      )}
    </View>
  );
}

function VerificationBadge({ profile }: { profile: ProfilePageData }) {
  if (profile.isFounder) return <FounderBadge showLabel style={styles.inlineBadge} />;
  if (profile.hasSubscription) return <PremiumBadge size={18} style={styles.inlineBadge} />;

  // No "Not Verified" badge: the app does no identity verification, so implying a
  // verification status (verified vs not) would mislead users about how vetted accounts are.
  return null;
}

function ProfileSection({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable style={styles.sectionAction} hitSlop={authHitSlop} onPress={onAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={18} color="#168BCF" />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function GroupsContent({ groups }: { groups: any[] }) {
  if (groups.length === 0) {
    return <SoftEmptyCard title="No Groups Yet" body="You haven't joined any groups" />;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalCards}>
      {groups.map((plan) => (
        <PlanCardHome key={plan.id} plan={plan} />
      ))}
    </ScrollView>
  );
}

function FriendsContent({ friends }: { friends: any[] }) {
  if (friends.length === 0) {
    return <SoftEmptyCard title="No Friends Yet" body="You haven't made any friends" />;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalCards}>
      {friends.map((friend) => (
        <PersonCard key={friend.id} person={friend} />
      ))}
    </ScrollView>
  );
}

function SoftEmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.softEmptyCard}>
      <View style={styles.emptyMascot}>
        <MascotSvg />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
      </View>
    </View>
  );
}

function SpaceBackground() {
  return (
    <LinearGradient
      colors={['#071D32', '#04172A', '#02101C']}
      style={StyleSheet.absoluteFillObject}>
      {STARS.map((star) => (
        <View
          key={star.id}
          style={[
            styles.star,
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </LinearGradient>
  );
}

function MascotSvg() {
  return (
    <Svg width={76} height={76} viewBox="0 0 76 76">
      <Circle cx="38" cy="38" r="28" fill="#43C8A2" />
      <Path d="M19 37C26 23 48 17 59 31C51 38 40 40 30 36C26 35 22 35 19 37Z" fill="#A9E8FF" />
      <Path d="M30 44C42 40 52 48 51 58C41 63 30 58 30 44Z" fill="#A9E8FF" />
      <Circle cx="29" cy="32" r="4" fill="#282B5F" />
      <Circle cx="47" cy="32" r="4" fill="#282B5F" />
      <Path d="M31 47C36 51 42 51 47 47" stroke="#282B5F" strokeWidth={3} strokeLinecap="round" />
      <Path d="M13 47L5 55" stroke="#43C8A2" strokeWidth={6} strokeLinecap="round" />
      <Path d="M63 47L71 55" stroke="#43C8A2" strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#061A2C',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingTitle: {
    marginTop: 14,
    color: '#111111',
    fontSize: 17,
    fontWeight: '800',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#061A2C',
    overflow: 'hidden',
  },
  floatingHeader: {
    position: 'absolute',
    left: 23,
    right: 22,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 20, 33, 0.45)',
  },
  avatarShell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3F8',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#111111',
    fontWeight: '900',
  },
  section: {
    marginTop: 32,
  },
  sectionHeader: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionActionText: {
    color: '#168BCF',
    fontSize: 15,
    fontWeight: '900',
  },
  horizontalCards: {
    paddingRight: 34,
  },
  softEmptyCard: {
    minHeight: 118,
    borderRadius: 13,
    backgroundColor: '#E4F3FF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 19,
  },
  emptyMascot: {
    width: 67,
    height: 67,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  emptyBody: {
    marginTop: 5,
    color: '#67717E',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  star: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  realGlobePosition: {
    position: 'absolute',
    top: 88,
    alignSelf: 'center',
  },
  globeFrame: {
    width: SCREEN_WIDTH * 0.82,
    height: SCREEN_WIDTH * 0.82,
    borderRadius: (SCREEN_WIDTH * 0.82) / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.74)',
    shadowColor: '#DFF6FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 24,
    backgroundColor: '#071D32',
  },
  globeGlow: {
    position: 'absolute',
    width: '104%',
    height: '104%',
    borderRadius: SCREEN_WIDTH,
    backgroundColor: 'rgba(117,215,255,0.18)',
    shadowColor: '#BFE7FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
  },
  worldStatsRow: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 238,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  worldStat: {
    flex: 1,
    alignItems: 'center',
  },
  worldStatValue: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  worldStatMuted: {
    color: 'rgba(255,255,255,0.76)',
  },
  worldStatLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.74)',
    fontSize: 15,
    fontWeight: '700',
  },
  worldDivider: {
    width: 1,
    height: 58,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  globeActions: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 162,
    flexDirection: 'row',
    gap: 12,
  },
  globeAction: {
    flex: 1,
    height: 47,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addCountryButton: {
    backgroundColor: '#087CFF',
  },
  editStyleButton: {
    backgroundColor: '#2DB658',
  },
  globeActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 18,
  },
  sheetHandleIndicator: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(17,24,39,0.14)',
  },
  sheetContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  sheetIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetStatsStrip: {
    flex: 1,
    marginLeft: 18,
  },
  statsStrip: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  miniStat: {
    alignItems: 'center',
    minWidth: 68,
  },
  miniStatValue: {
    color: '#111111',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  miniStatLabel: {
    marginTop: 4,
    color: '#777C83',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  expandedNameRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  expandedNameLeft: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexWrap: 'wrap',
  },
  expandedName: {
    fontFamily: display('700'),
    color: '#111111',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  inlineBadge: {
    marginTop: 2,
  },
  notVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 6,
    backgroundColor: '#FFF1F4',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  notVerifiedText: {
    color: '#E84D68',
    fontSize: 12,
    fontWeight: '900',
  },
  locationRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  flagText: {
    fontSize: 17,
  },
  locationText: {
    flex: 1,
    color: '#6E737B',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
  },
  editProfileLink: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  editProfileText: {
    color: '#4A4A4A',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  bioText: {
    marginTop: 22,
    color: '#1C1D20',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  socialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  socialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: authColors.surface,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '500',
    color: authColors.textPrimary,
  },
});
