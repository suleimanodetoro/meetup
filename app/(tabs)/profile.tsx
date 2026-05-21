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
  bg: '#FFFFFF',
  text: '#0B1220',
  sub: '#6B7280',
  border: '#EAEAEA',
  blue: '#007AFF',
  soft: '#F5F5F5',
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

    const uniqueCountries = new Set(visitsData?.map((v) => v.country) || []);

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

    const plans = (data || []).map((p) => p.events).filter(Boolean);
    setJoinedPlans(plans as any);
  };

  const fetchFriends = async () => {
    if (!session?.user?.id) return;

    try {
      // Query the friendships table (not 'friends')
      const { data, error } = await supabase
        .from('friendships')
        .select(
          `
        id,
        requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, nationality, nationality_code),
        addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, nationality, nationality_code)
      `
        )
        .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`)
        .eq('status', 'accepted')
        .limit(6);

      if (error) {
        console.error('Error fetching friends:', error);
        return;
      }

      // Map to get the friend (the person who is NOT the current user)
      const friendsList = (data || [])
        .map((friendship) => {
          // If I'm the requester, the friend is the addressee, and vice versa
          return friendship.requester?.id === session.user.id
            ? friendship.addressee
            : friendship.requester;
        })
        .filter(Boolean);

      setFriends(friendsList);
    } catch (error) {
      console.error('Error in fetchFriends:', error);
    }
  };

  const fetchPendingRequestsCount = async () => {
    if (!session?.user?.id) return;

    // Query friendships table (not 'friends')
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', session.user.id)
      .eq('status', 'pending');

    setPendingRequestsCount(count || 0);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* CLEAN HEADER - No bio section */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
            {/* Profile Info */}
            <View style={{ flexDirection: 'row', gap: 14, flex: 1 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: C.soft,
                  overflow: 'hidden',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <Text style={{ fontSize: 28, fontWeight: '600', color: C.sub }}>
                    {(profile?.full_name?.[0] || 'T').toUpperCase()}
                  </Text>
                )}
              </View>

              <View style={{ justifyContent: 'center', flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>
                  {profile?.full_name || 'J. Doe'}
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

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => router.push('/edit-profile')}
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
                hitSlop={12}>
                <Ionicons name="create-outline" size={20} color={C.text} />
              </Pressable>

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
                }}>
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
                    }}>
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
                hitSlop={12}>
                <Ionicons name="settings-outline" size={20} color={C.text} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 18 }}>
          <StatBox value={stats.plansCount} label="Plans" />
          <StatBox value={stats.totalTrips} label="Trips" />
          <StatBox value={stats.countriesVisited} label="Visited" />
        </View>

        {/* Upcoming Trips */}
        <SectionHeader title="Upcoming Trips" />

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
          <SectionHeader title="Plans you Joined" />

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
            <EmptyPlans />
          )}
        </View>

        {/* My Friends */}
        <View style={{ marginTop: 24, marginBottom: 40 }}>
          <SectionHeader title="My Friends" />

          {friends.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={friends}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => <PersonCard person={item} />}
            />
          ) : (
            <EmptyFriends />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Components
function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
      }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: C.text }}>{value}</Text>
      <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        marginBottom: 16,
      }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{title}</Text>
    </View>
  );
}

function EmptyUpcoming() {
  return (
    <View
      style={{
        marginHorizontal: 20,
        backgroundColor: C.bg,
        borderRadius: 16,
        paddingVertical: 48,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
      }}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>🌍</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 4 }}>
        No upcoming trips yet
      </Text>
      <Pressable
        onPress={() => router.push('/add-trip')}
        style={{
          backgroundColor: C.blue,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 24,
          marginTop: 16,
        }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Add New Trip</Text>
      </Pressable>
    </View>
  );
}

function EmptyPlans() {
  return (
    <View
      style={{
        marginHorizontal: 20,
        backgroundColor: '#F8F9FA',
        borderRadius: 16,
        paddingVertical: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
      }}>
      <Text style={{ fontSize: 48, marginBottom: 8 }}>🗓️</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>No Plans Yet</Text>
      <Text style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>You haven't joined any plans</Text>
    </View>
  );
}

function EmptyFriends() {
  return (
    <View
      style={{
        marginHorizontal: 20,
        backgroundColor: '#F8F9FA',
        borderRadius: 16,
        paddingVertical: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
      }}>
      <Text style={{ fontSize: 48, marginBottom: 8 }}>👥</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.text }}>No Friends Yet</Text>
      <Text style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
        Start connecting with travelers
      </Text>
    </View>
  );
}