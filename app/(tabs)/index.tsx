// app/(tabs)/index.tsx
// Unified discovery map (home): nearby SIDEQUESTS + PEOPLE on one Mapbox map,
// a Both/Sidequests/People filter, and a @gorhom split sheet (Sidequests | People)
// whose "See more" opens the city view on the matching tab. This is the single
// discovery surface — the old people-only Map tab is folded in (hidden in _layout).
//
// Events/profiles carry no precise coordinate (the app keeps location coarse, by
// design), so markers are scattered deterministically around the city centroid.
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Mapbox, { Camera, MapView, MarkerView } from '@rnmapbox/maps';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { useSubscription } from '~/hooks/useSubscription';
import { getCityCoordinates } from '~/utils/geographic';
import { AppImage } from '~/components/AppImage';
import { InitialsAvatar } from '~/components/InitialsAvatar';
import { PremiumBadge } from '~/components/PremiumBadge';
import { authColors, authHitSlop, authSpace, authType } from '~/utils/authTheme';
import { display } from '~/utils/fonts';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const FLOATING_TAB_BAR_HEIGHT = 64;
const FLOATING_TAB_BAR_GAP = 12;
const SHEET_COLLAPSED = 300;

type Filter = 'both' | 'sidequests' | 'people';

interface Sidequest {
  id: number;
  title: string;
  image_uri: string | null;
  attendee_count: number;
  coord: [number, number];
}
interface Person {
  id: string;
  full_name: string;
  avatar_url: string | null;
  coord: [number, number];
}

// Scatter markers in a spiral around the centroid; `phase` separates the two
// layers so people and sidequests don't sit on top of each other.
function scatter(center: [number, number], i: number, phase = 0): [number, number] {
  const golden = 2.399963;
  const r = 0.0035 * Math.sqrt(i + 0.5);
  const a = i * golden + phase;
  const lngScale = Math.max(0.2, Math.cos((center[1] * Math.PI) / 180));
  return [center[0] + (r * Math.cos(a)) / lngScale, center[1] + r * Math.sin(a)];
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { hasSubscription } = useSubscription();
  const cameraRef = useRef<Camera>(null);
  const sheetRef = useRef<BottomSheet>(null);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [city, setCity] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [sidequests, setSidequests] = useState<Sidequest[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [filter, setFilter] = useState<Filter>('both');
  const [mapReady, setMapReady] = useState(false);

  const trayClearance =
    Math.max(insets.bottom, 16) + FLOATING_TAB_BAR_HEIGHT + FLOATING_TAB_BAR_GAP;
  const snapPoints = useMemo(() => [SHEET_COLLAPSED, '88%'], []);

  const fetchHome = useCallback(async () => {
    try {
      if (!session?.user?.id) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('location, location_country, location_country_code, avatar_url')
        .eq('id', session.user.id)
        .single();
      setProfile(prof);
      setCity(prof?.location ?? null);
      setCountry(prof?.location_country ?? null);

      let cityCenter: [number, number] | null = null;
      if (prof?.location) {
        try {
          const c = await getCityCoordinates(
            prof.location,
            prof.location_country_code ?? undefined
          );
          cityCenter = [c.lng, c.lat];
        } catch {
          cityCenter = null;
        }
      }
      setCenter(cityCenter);
      const base: [number, number] = cityCenter ?? [0, 0];

      // Sidequests (open quests in the city; fall back to popular).
      let rows: any[] = [];
      if (prof?.location) {
        const { data, error } = await supabase.rpc('get_city_plans_ranked', {
          city_name: prof.location,
        });
        if (!error && data) rows = data;
      }
      if (rows.length === 0) {
        const { data } = await supabase.rpc('get_popular_plans_with_attendees');
        rows = data ?? [];
      }
      setSidequests(
        rows.slice(0, 12).map((r: any, i: number) => ({
          id: r.event_id ?? r.id,
          title: r.title,
          image_uri: r.image_uri ?? null,
          attendee_count: r.attendee_count ?? 0,
          coord: scatter(base, i),
        }))
      );

      // People nearby (block/visibility-safe RPC).
      let ppl: Person[] = [];
      if (prof?.location) {
        const { data: pdata } = await supabase.rpc('get_users_in_city', {
          city_name: prof.location,
          country_name: prof.location_country ?? undefined,
        });
        ppl = ((pdata ?? []) as any[]).slice(0, 12).map((u, i) => ({
          id: u.id,
          full_name: u.full_name ?? 'Someone',
          avatar_url: u.avatar_url ?? null,
          coord: scatter(base, i, Math.PI),
        }));
      }
      setPeople(ppl);
    } catch (err) {
      console.error('Home fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const recenter = useCallback(() => {
    if (center) {
      cameraRef.current?.setCamera({
        centerCoordinate: center,
        zoomLevel: 12,
        animationDuration: 800,
      });
    }
  }, [center]);

  const goCity = useCallback(
    (tab: 'users' | 'plans') => {
      if (!city) return;
      router.push({
        pathname: '/city/[name]',
        params: { name: city, tab, country: country ?? '' },
      });
    },
    [city, country]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={authColors.accent} />
        <Text style={styles.loadingText}>Loading</Text>
      </SafeAreaView>
    );
  }

  const showQuests = filter !== 'people';
  const showPeople = filter !== 'sidequests';

  return (
    <View style={styles.container}>
      {center ? (
        <MapView
          style={StyleSheet.absoluteFillObject}
          styleURL={Mapbox.StyleURL.Light}
          compassEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={() => setMapReady(true)}>
          <Camera
            ref={cameraRef}
            centerCoordinate={center}
            zoomLevel={12}
            padding={{
              paddingTop: 120,
              paddingBottom: SHEET_COLLAPSED,
              paddingLeft: 0,
              paddingRight: 0,
            }}
            animationMode="flyTo"
            animationDuration={1200}
          />
          {mapReady &&
            showQuests &&
            sidequests.map((q) => (
              <MarkerView key={`q-${q.id}`} coordinate={q.coord} anchor={{ x: 0.5, y: 1 }}>
                <Pressable style={styles.qMarker} onPress={() => router.push(`/event/${q.id}`)}>
                  <View style={styles.qMarkerImageWrap}>
                    {q.image_uri ? (
                      <AppImage source={{ uri: q.image_uri }} style={styles.qMarkerImage} />
                    ) : (
                      <View style={styles.qMarkerFallback}>
                        <Ionicons name="compass" size={20} color={authColors.accent} />
                      </View>
                    )}
                  </View>
                  <View style={styles.qMarkerTail} />
                </Pressable>
              </MarkerView>
            ))}
          {mapReady &&
            showPeople &&
            people.map((p) => (
              <MarkerView key={`p-${p.id}`} coordinate={p.coord} anchor={{ x: 0.5, y: 0.5 }}>
                <Pressable style={styles.pMarker} onPress={() => router.push(`/profile/${p.id}`)}>
                  {p.avatar_url ? (
                    <AppImage source={{ uri: p.avatar_url }} style={styles.pMarkerImg} />
                  ) : (
                    <InitialsAvatar name={p.full_name} id={p.id} size={42} />
                  )}
                </Pressable>
              </MarkerView>
            ))}
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.noLocationMap]} />
      )}

      {/* Top bar + filter chips */}
      <SafeAreaView pointerEvents="box-none" style={styles.topOverlay}>
        <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
          <View style={styles.brandPill}>
            <View style={styles.brandLogo}>
              <AppImage
                source={require('../../assets/ios-light.png')}
                style={styles.brandLogoImg}
                contentFit="cover"
                transition={0}
              />
            </View>
            <Text style={styles.brandTitle}>Waypoint</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable
              style={styles.iconButton}
              hitSlop={authHitSlop}
              onPress={() => router.push('/friend-requests')}>
              <Ionicons name="notifications-outline" size={22} color={authColors.textPrimary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={authHitSlop}
              style={styles.avatarButton}>
              <View style={styles.avatar}>
                {profile?.avatar_url ? (
                  <AppImage source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={18} color={authColors.textTertiary} />
                  </View>
                )}
              </View>
              {hasSubscription && (
                <PremiumBadge size={14} style={{ position: 'absolute', bottom: -3, right: -3 }} />
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.chipsRow}>
          {(['both', 'sidequests', 'people'] as Filter[]).map((f) => {
            const on = filter === f;
            const label = f === 'both' ? 'Both' : f === 'sidequests' ? 'Sidequests' : 'People';
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      {/* Floating action buttons (above the collapsed sheet) */}
      <View style={[styles.fabColumn, { bottom: trayClearance + SHEET_COLLAPSED + 16 }]}>
        {center && (
          <Pressable style={styles.fabLight} onPress={recenter} hitSlop={authHitSlop}>
            <Ionicons name="navigate" size={20} color={authColors.textPrimary} />
          </Pressable>
        )}
        <Pressable
          style={styles.fabPrimary}
          onPress={() => router.push('/create-plan/intent' as never)}
          hitSlop={authHitSlop}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Split sheet: Sidequests | People */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        bottomInset={trayClearance}
        enablePanDownToClose={false}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBg}>
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {showQuests && (
            <Section
              title={
                sidequests.length === 1
                  ? '1 sidequest nearby'
                  : `${sidequests.length} sidequests nearby`
              }
              onSeeMore={sidequests.length ? () => goCity('plans') : undefined}>
              {sidequests.length === 0 ? (
                <Text style={styles.empty}>No sidequests nearby yet — start one with +.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carousel}>
                  {sidequests.map((q) => (
                    <Pressable
                      key={q.id}
                      style={styles.qCard}
                      onPress={() => router.push(`/event/${q.id}`)}>
                      <View style={styles.qCardImgWrap}>
                        {q.image_uri ? (
                          <AppImage source={{ uri: q.image_uri }} style={styles.qCardImg} />
                        ) : (
                          <View style={styles.qCardFallback}>
                            <Ionicons name="compass" size={26} color={authColors.accent} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.qCardTitle} numberOfLines={2}>
                        {q.title}
                      </Text>
                      <Text style={styles.qCardMeta}>
                        {q.attendee_count > 0 ? `${q.attendee_count} going` : 'Be first'}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </Section>
          )}

          {showPeople && (
            <Section
              title={people.length === 1 ? '1 person nearby' : `${people.length} people nearby`}
              onSeeMore={people.length ? () => goCity('users') : undefined}>
              {people.length === 0 ? (
                <Text style={styles.empty}>No one nearby yet.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carousel}>
                  {people.map((p) => (
                    <Pressable
                      key={p.id}
                      style={styles.pCard}
                      onPress={() => router.push(`/profile/${p.id}`)}>
                      <View style={styles.pCardAvatar}>
                        {p.avatar_url ? (
                          <AppImage source={{ uri: p.avatar_url }} style={styles.pCardImg} />
                        ) : (
                          <InitialsAvatar name={p.full_name} id={p.id} size={64} />
                        )}
                      </View>
                      <Text style={styles.pCardName} numberOfLines={1}>
                        {p.full_name?.split(' ')[0] ?? 'Someone'}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </Section>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

function Section({
  title,
  onSeeMore,
  children,
}: {
  title: string;
  onSeeMore?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeMore ? (
          <Pressable onPress={onSeeMore} hitSlop={authHitSlop} style={styles.seeMore}>
            <Text style={styles.seeMoreText}>See more</Text>
            <Ionicons name="chevron-forward" size={15} color={authColors.accent} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 10,
  elevation: 4,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: authColors.bg },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpace.md,
    backgroundColor: authColors.bg,
  },
  loadingText: { color: authColors.textSecondary, fontSize: authType.body.fontSize },
  noLocationMap: { backgroundColor: '#E9ECEF' },

  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: authSpace.lg,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
    ...SHADOW,
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: authColors.accentSoft,
  },
  brandLogoImg: { width: '100%', height: '100%' },
  brandTitle: {
    fontFamily: display('700'),
    fontSize: 16,
    fontWeight: '800',
    color: authColors.textPrimary,
    letterSpacing: -0.2,
    paddingRight: 4,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...SHADOW,
  },
  avatarButton: { position: 'relative' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: authColors.borderMuted,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: authSpace.lg, marginTop: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    ...SHADOW,
  },
  chipOn: { backgroundColor: authColors.accent },
  chipText: { fontSize: 14, fontWeight: '600', color: authColors.textPrimary },
  chipTextOn: { color: '#fff' },

  // sidequest markers
  qMarker: { alignItems: 'center' },
  qMarkerImageWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: authColors.accentSoft,
    ...SHADOW,
    shadowOpacity: 0.2,
  },
  qMarkerImage: { width: '100%', height: '100%' },
  qMarkerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qMarkerTail: {
    width: 10,
    height: 10,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginTop: -6,
  },
  // people markers
  pMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: authColors.accent,
    backgroundColor: '#fff',
    ...SHADOW,
    shadowOpacity: 0.2,
  },
  pMarkerImg: { width: '100%', height: '100%' },

  // FABs
  fabColumn: { position: 'absolute', right: authSpace.lg, gap: 12, alignItems: 'center' },
  fabLight: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
    shadowOpacity: 0.18,
  },
  fabPrimary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: authColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  // sheet
  sheetBg: {
    backgroundColor: authColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: { backgroundColor: authColors.borderSubtle, width: 40 },
  sheetContent: { paddingBottom: authSpace.xxl },
  section: { marginTop: authSpace.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: authSpace.xl,
    marginBottom: authSpace.sm,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: authColors.textPrimary,
    letterSpacing: -0.3,
  },
  seeMore: { flexDirection: 'row', alignItems: 'center' },
  seeMoreText: { color: authColors.accent, fontSize: authType.link.fontSize, fontWeight: '600' },
  carousel: { paddingHorizontal: authSpace.xl, gap: authSpace.md },
  empty: {
    paddingHorizontal: authSpace.xl,
    color: authColors.textSecondary,
    fontSize: authType.disclaimer.fontSize,
  },

  qCard: { width: 150 },
  qCardImgWrap: {
    width: 150,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: authColors.accentSoft,
    marginBottom: 8,
  },
  qCardImg: { width: '100%', height: '100%' },
  qCardFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qCardTitle: { fontSize: 14, fontWeight: '700', color: authColors.textPrimary },
  qCardMeta: {
    marginTop: 2,
    fontSize: authType.disclaimer.fontSize,
    color: authColors.textSecondary,
  },

  pCard: { width: 76, alignItems: 'center' },
  pCardAvatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', marginBottom: 6 },
  pCardImg: { width: '100%', height: '100%' },
  pCardName: { fontSize: 13, fontWeight: '600', color: authColors.textPrimary },
});
