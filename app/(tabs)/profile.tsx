// app/(tabs)/profile.tsx
// ============================================
// SIMPLE PROFILE SCREEN (no globe / no modal-style transitions)
// ============================================
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { Visit, Profile } from '~/types/db';
import { getCountryFlag } from '~/utils/countryFlags';
import { getCityImageUrl } from '~/utils/cityImages';

// Modular components
import VisitCard from '~/components/VisitCard';
import PlanCardHome from '~/components/PlanCardHome';
import PersonCard from '~/components/PersonCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileScreen() {
  const { session } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [pastVisits, setPastVisits] = useState<Visit[]>([]);
  const [joinedPlans, setJoinedPlans] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [stats, setStats] = useState({
    totalTrips: 0,
    upcomingTrips: 0,
    countriesVisited: 0,
    plansCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfileData();
    fetchFriends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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
      const { data: userVisits, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .eq('user_id', session.user.id)
        .order('start_date', { ascending: false });

      if (visitsError) console.error('Error fetching visits:', visitsError);

      if (userVisits && userVisits.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming: any[] = [];
        const past: Visit[] = [];

        for (const visit of userVisits) {
          const endDate = new Date(visit.end_date);
          endDate.setHours(23, 59, 59, 999);

          // Transform to match VisitCard expectations
          const transformed = {
            ...visit,
            user_count: 1,
            image_url: getCityImageUrl(visit.city),
            recent_users: [
              {
                id: session.user.id,
                full_name: profileData?.full_name,
                avatar_url: profileData?.avatar_url,
              },
            ],
          };

          if (endDate >= today) {
            upcoming.push(transformed);
          } else {
            past.push(visit);
          }
        }

        setAllVisits(userVisits);
        setUpcomingVisits(upcoming);
        setPastVisits(past);

        const uniqueCountries = new Set(
          userVisits.map((v) => v.country_code).filter(Boolean)
        );

        setStats((prev) => ({
          ...prev,
          totalTrips: userVisits.length,
          upcomingTrips: upcoming.length,
          countriesVisited: uniqueCountries.size,
        }));
      } else {
        setAllVisits([]);
        setUpcomingVisits([]);
        setPastVisits([]);
        setStats((prev) => ({
          ...prev,
          totalTrips: 0,
          upcomingTrips: 0,
          countriesVisited: 0,
        }));
      }

      // Joined plans
      const { data: attendance } = await supabase
        .from('attendance')
        .select('event_id')
        .eq('user_id', session.user.id);

      if (attendance && attendance.length > 0) {
        const eventIds = attendance.map((a) => a.event_id);

        // Prefer RPC for richer data if available
        const { data: plansWithAttendees, error: rpcError } = await supabase
          .rpc('get_popular_plans_with_attendees');

        if (!rpcError && plansWithAttendees) {
          const myPlans = plansWithAttendees.filter((plan: any) =>
            eventIds.includes(plan.id)
          );
          setJoinedPlans(myPlans);
          setStats((p) => ({ ...p, plansCount: myPlans.length }));
        } else {
          // Fallback
          const { data: events } = await supabase
            .from('events')
            .select('*')
            .in('id', eventIds)
            .gte('date', new Date().toISOString())
            .order('date', { ascending: true });

          if (events) {
            const transformedPlans = events.map((event: any) => ({
              ...event,
              attendee_count: 0,
              recent_attendees: [],
            }));
            setJoinedPlans(transformedPlans);
            setStats((p) => ({ ...p, plansCount: transformedPlans.length }));
          }
        }
      }

      // Pending friend requests
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('addressee_id', session.user.id)
        .eq('status', 'pending');

      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.error('Error fetching profile data:', error);
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

      if (friendships) {
        const friendProfiles = friendships
          .map((f: any) =>
            f.requester_id === session.user.id ? f.addressee : f.requester
          )
          .filter(Boolean);
        setFriends(friendProfiles);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
        <StatusBar barStyle="dark-content" />
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: 'white',
          borderBottomWidth: 1,
          borderBottomColor: '#eee',
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#4A90E2',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                />
              ) : (
                <Text style={{ fontSize: 22, color: 'white' }}>
                  {profile?.full_name?.[0] || 'T'}
                </Text>
              )}
            </View>

            <View>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>
                {profile?.full_name || 'Traveler'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Text style={{ fontSize: 18 }}>
                  {getCountryFlag(profile?.nationality_code || 'US')}
                </Text>
                <Text style={{ fontSize: 13, color: '#666' }}>
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
                backgroundColor: '#F5F5F5',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <Ionicons name="notifications-outline" size={20} color="#333" />
              {pendingRequestsCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: '#FF3B30',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 8, fontWeight: 'bold' }}>
                    {pendingRequestsCount}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F5F5F5',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#333" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 24,
          backgroundColor: '#F5F5F5',
          minHeight: SCREEN_HEIGHT - 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Bio + Edit */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 }}>
          {profile?.bio ? (
            <Text style={{ fontSize: 14, color: '#555' }}>{profile.bio}</Text>
          ) : (
            <Text style={{ fontSize: 14, color: '#999', fontStyle: 'italic' }}>
              No bio yet
            </Text>
          )}

          <Pressable
            onPress={() => router.push('/edit-profile')}
            style={{ marginTop: 10 }}
          >
            <Text style={{ fontSize: 15, color: '#4A90E2', fontWeight: '600' }}>
              Edit Profile ›
            </Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 20,
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            { label: 'Plans', value: stats.plansCount },
            { label: 'Trips', value: stats.totalTrips },
            { label: 'Countries', value: stats.countriesVisited },
          ].map((stat, idx) => (
            <View
              key={idx}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#E0E0E0',
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
                backgroundColor: 'white',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>
                {stat.value}
              </Text>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Upcoming Trips */}
        <View style={{ marginBottom: 28 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700' }}>Upcoming Trips</Text>
            {upcomingVisits.length > 0 && (
              <Pressable onPress={() => router.push('/my-trips')}>
                <Text style={{ fontSize: 14, color: '#4A90E2' }}>See all ›</Text>
              </Pressable>
            )}
          </View>

          {upcomingVisits.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={upcomingVisits}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <VisitCard visit={item} />}
            />
          ) : (
            <View style={{ paddingHorizontal: 20 }}>
              <Pressable
                onPress={() => router.push('/add-trip')}
                style={{
                  backgroundColor: '#F0F0F0',
                  borderRadius: 12,
                  padding: 32,
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: '#E0E0E0',
                  borderStyle: 'dashed',
                }}
              >
                <Ionicons name="add-circle-outline" size={40} color="#999" />
                <Text style={{ fontSize: 15, color: '#666', marginTop: 10 }}>
                  Add your first trip
                </Text>
                <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
                  Connect with travelers going to the same places
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Joined Plans */}
        <View style={{ marginBottom: 28 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700' }}>My Plans</Text>
            {joinedPlans.length > 0 && (
              <Pressable onPress={() => router.push('/my-plans')}>
                <Text style={{ fontSize: 14, color: '#4A90E2' }}>See all ›</Text>
              </Pressable>
            )}
          </View>

          {joinedPlans.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={joinedPlans}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <PlanCardHome plan={item} />}
            />
          ) : (
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: 'white',
                borderRadius: 12,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#eee',
              }}
            >
              <Text style={{ fontSize: 44, marginBottom: 6 }}>🎯</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                No Plans Yet
              </Text>
              <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
                Join plans to meet other travelers
              </Text>
            </View>
          )}
        </View>

        {/* Friends */}
        <View style={{ marginBottom: 40 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700' }}>
              My Friends ({friends.length})
            </Text>
            {friends.length > 0 && (
              <Pressable onPress={() => router.push('/friends')}>
                <Text style={{ fontSize: 14, color: '#4A90E2' }}>See all ›</Text>
              </Pressable>
            )}
          </View>

          {friends.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={friends.slice(0, 6)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <PersonCard person={item} />}
            />
          ) : (
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: 'white',
                borderRadius: 12,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#eee',
              }}
            >
              <Text style={{ fontSize: 44, marginBottom: 6 }}>👥</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 6 }}>
                No Friends Yet
              </Text>
              <Text
                style={{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 12 }}
              >
                Find friends from your visits and plans
              </Text>
              <Pressable
                onPress={() => router.push('/search-users')}
                style={{
                  backgroundColor: '#4A90E2',
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>Find Friends</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
