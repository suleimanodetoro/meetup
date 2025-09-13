// app/(tabs)/profile.tsx

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  FlatList,
  ScrollView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { Visit, Profile } from '~/types/db';
import { getCountryFlag } from '~/utils/countryFlags';
import { getCityImageUrl } from '~/utils/cityImages';

import VisitCard from '~/components/VisitCard';
import PlanCardHome from '~/components/PlanCardHome';
import PersonCard from '~/components/PersonCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const C = {
  bg: '#FFFFFF',         // everything white
  text: '#0B1220',
  sub: '#6B7280',
  border: '#EAEAEA',     // subtle borders
  blue: '#007AFF',       // iOS blue for actions/links
  soft: '#F5F5F5',       // icon chips
  badge: '#FF3B30',
};

export default function ProfileScreen() {
  const { session } = useAuth();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, []);

  const fetchAll = async () => {
    await Promise.all([fetchProfileData(), fetchFriends()]);
  };

  const fetchProfileData = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);

      // Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profileData) setProfile(profileData);

      // Visits
      const { data: userVisits } = await supabase
        .from('visits')
        .select('*')
        .eq('user_id', session.user.id)
        .order('start_date', { ascending: false });

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const upcoming: any[] = [];
      const countries = new Set<string>();

      (userVisits || []).forEach((v) => {
        if (v.country_code) countries.add(v.country_code);
        const end = new Date(v.end_date); end.setHours(23, 59, 59, 999);
        const t = {
          ...v,
          user_count: 1,
          image_url: getCityImageUrl(v.city),
          recent_users: [
            { id: session.user.id, full_name: profileData?.full_name, avatar_url: profileData?.avatar_url },
          ],
        };
        if (end >= today) upcoming.push(t);
      });

      setUpcomingVisits(upcoming);
      setStats({
        totalTrips: (userVisits || []).length,
        countriesVisited: countries.size,
        plansCount: 0, // will be set after plans fetch below
      });

      // Joined plans
      const { data: attendance } = await supabase
        .from('attendance')
        .select('event_id')
        .eq('user_id', session.user.id);

      if (attendance?.length) {
        const eventIds = attendance.map((a) => a.event_id);
        const { data: plansWithAttendees, error: rpcError } = await supabase
          .rpc('get_popular_plans_with_attendees');

        if (!rpcError && plansWithAttendees) {
          const mine = plansWithAttendees.filter((p: any) => eventIds.includes(p.id));
          setJoinedPlans(mine);
          setStats((s) => ({ ...s, plansCount: mine.length }));
        } else {
          const { data: events } = await supabase
            .from('events')
            .select('*')
            .in('id', eventIds)
            .gte('date', new Date().toISOString())
            .order('date', { ascending: true });

          const fallback = (events || []).map((e: any) => ({ ...e, attendee_count: 0, recent_attendees: [] }));
          setJoinedPlans(fallback);
          setStats((s) => ({ ...s, plansCount: fallback.length }));
        }
      } else {
        setJoinedPlans([]);
        setStats((s) => ({ ...s, plansCount: 0 }));
      }

      // Pending friend requests
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', session.user.id)
        .eq('status', 'pending');

      setPendingRequestsCount(count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    if (!session?.user?.id) return;
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select(
          `
          id,
          requester_id,
          addressee_id,
          requester:profiles!friendships_requester_id_fkey(
            id, full_name, avatar_url, bio, nationality_code
          ),
          addressee:profiles!friendships_addressee_id_fkey(
            id, full_name, avatar_url, bio, nationality_code
          )
        `
        )
        .eq('status', 'accepted')
        .or(
          `requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`
        );

      const friendProfiles =
        (friendships || [])
          .map((f: any) => (f.requester_id === session.user.id ? f.addressee : f.requester))
          .filter(Boolean) || [];
      setFriends(friendProfiles);
    } catch (e) {
      console.error(e);
    }
  };

  const StatBox = ({ value, label }: { value: number; label: string }) => (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: C.bg,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{value}</Text>
      <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{label}</Text>
    </View>
  );

  const SectionHeader = ({
    title,
    showSeeAll,
    onPress,
  }: { title: string; showSeeAll?: boolean; onPress?: () => void }) => (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{title}</Text>
      {showSeeAll ? (
        <Pressable onPress={onPress} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.blue, fontSize: 14, fontWeight: '600' }}>See all</Text>
          <Ionicons name="chevron-forward" size={16} color={C.blue} />
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );

  const EmptyUpcoming = () => (
    <View
      style={{
        marginHorizontal: 20,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 14,
        paddingVertical: 24,
        alignItems: 'center',
        backgroundColor: C.bg,
      }}
    >
      <Text style={{ fontSize: 48, marginBottom: 10 }}>🌍</Text>
      <Text style={{ color: C.sub, fontSize: 14, marginBottom: 12 }}>
        You don't have any upcoming trips yet
      </Text>
      <Pressable
        onPress={() => router.push('/add-trip')}
        style={{
          backgroundColor: C.blue,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 22,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add New Trip</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />
        }
        contentContainerStyle={{ paddingBottom: 28, minHeight: SCREEN_HEIGHT - 80, backgroundColor: C.bg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header (scrolls with content) */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  overflow: 'hidden',
                  backgroundColor: C.soft,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={{ width: 56, height: 56 }} />
                ) : (
                  <Text style={{ fontSize: 22, color: C.sub }}>
                    {(profile?.full_name?.[0] || 'T').toUpperCase()}
                  </Text>
                )}
              </View>

              <View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>
                  {profile?.full_name || 'Traveler'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 18 }}>
                    {getCountryFlag(profile?.nationality_code || 'US')}
                  </Text>
                  <Text style={{ fontSize: 13, color: C.sub }}>
                    {profile?.nationality || 'United States'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => router.push('/friend-requests')}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <Ionicons name="notifications-outline" size={20} color={C.text} />
                {pendingRequestsCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: C.badge,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                      {pendingRequestsCount}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.push('/settings')}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                hitSlop={12}
              >
                <Ionicons name="settings-outline" size={20} color={C.text} />
              </Pressable>
            </View>
          </View>

          {/* Bio + Edit */}
          <View style={{ marginTop: 8 }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 14,
                color: profile?.bio ? C.sub : '#9CA3AF',
                fontStyle: profile?.bio ? 'normal' : 'italic',
              }}
            >
              {profile?.bio || 'Add a short bio so travelers know you'}
            </Text>
            <Pressable onPress={() => router.push('/edit-profile')} style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 15, color: C.blue, fontWeight: '700' }}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 18 }}>
          <StatBox value={stats.plansCount} label="Plans" />
          <StatBox value={stats.totalTrips} label="Trips" />
          <StatBox value={stats.countriesVisited} label="Visited" />
        </View>

        {/* Upcoming Trips */}
        <SectionHeader
          title="Upcoming Trips"
          showSeeAll={upcomingVisits.length > 0}
          onPress={() => router.push('/my-trips')}
        />

        {upcomingVisits.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={upcomingVisits}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            renderItem={({ item }) => <VisitCard visit={item} />}
          />
        ) : (
          <EmptyUpcoming />
        )}

        {/* Plans you Joined */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader
            title="Plans you Joined"
            showSeeAll={joinedPlans.length > 0}
            onPress={() => router.push('/my-plans')}
          />

          {joinedPlans.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={joinedPlans}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => <PlanCardHome plan={item} />}
            />
          ) : (
            <View
              style={{
                marginHorizontal: 20,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 14,
                padding: 22,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 4 }}>🎯</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 }}>
                No Plans Yet
              </Text>
              <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center' }}>
                Join plans to meet other travelers
              </Text>
            </View>
          )}
        </View>

        {/* Friends */}
        <View style={{ marginTop: 24 }}>
          <SectionHeader
            title={`Friends (${friends.length})`}
            showSeeAll={friends.length > 0}
            onPress={() => router.push('/friends')}
          />

          {friends.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={friends.slice(0, 6)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
              renderItem={({ item }) => <PersonCard person={item} />}
            />
          ) : (
            <View
              style={{
                marginHorizontal: 20,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 14,
                padding: 22,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 40, marginBottom: 6 }}>👥</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6 }}>
                No Friends Yet
              </Text>
              <Pressable
                onPress={() => router.push('/search-users')}
                style={{
                  backgroundColor: C.blue,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Find Friends</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
