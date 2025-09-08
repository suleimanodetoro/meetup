// ============================================
// app/(tabs)/index.tsx - FIXED VERSION
// ============================================
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
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { getCountryFlag } from '~/utils/countryFlags';
import { getCityImageUrl } from '~/utils/cityImages'; // ← ADDED
import type { Event, Profile } from '~/types/db';

// Import your components (note the filenames)
import VisitCard from '~/components/VisitCard';
import PlanCardHome from '~/components/PlanCardHome';
import PersonCard from '~/components/PersonCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Small inline component: Category Pill(kept inline since it's trivial and screen-specific)
const CategoryPill = React.memo(
  ({
    label,
    icon,
    isActive,
    onPress,
  }: {
    label: string;
    icon?: string | null;
    isActive: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select category ${label}`}
      hitSlop={8}
      style={{
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        backgroundColor: isActive ? '#4A90E2' : 'white',
        borderWidth: 1,
        borderColor: isActive ? '#4A90E2' : '#E0E0E0',
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
      }}
    >
      {icon ? <Text style={{ fontSize: 20, marginRight: 8 }}>{icon}</Text> : null}
      <Text
        style={{
          fontSize: 15,
          fontWeight: '500',
          color: isActive ? 'white' : '#333',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
);

// ============================================
// MAIN HOME SCREEN
// ============================================
export default function HomeScreen() {
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('for you');

  // Data states
  const [trendingVisits, setTrendingVisits] = useState<any[]>([]);
  const [popularPlans, setPopularPlans] = useState<any[]>([]);
  const [newPlans, setNewPlans] = useState<any[]>([]);
  const [suggestedPeople, setSuggestedPeople] = useState<Profile[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  const categories = [
    { id: 'for you', label: 'for you', icon: null },
    { id: 'tropical', label: 'tropical', icon: '🏝' },
    { id: 'hiking', label: 'hiking', icon: '🥾' },
    { id: 'backpacking', label: 'backpacking', icon: '🎒' },
    { id: 'adventure', label: 'adventure', icon: '🏔' },
    { id: 'culture', label: 'culture', icon: '🏛' },
  ];

  const fetchHomeData = useCallback(async () => {
    try {
      // Fetch user profile
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) setUserProfile(profile);
      }

      // Note: the following RPCs must exist in your Supabase project.
      // If they're not deployed yet, replace these with basic table queries temporarily.

      // Trending visits - FIXED: Add images based on city name
      const { data: visits, error: visitsError } = await supabase.rpc('get_trending_visits');
      if (visitsError) throw visitsError;
      
      // Transform visits to ensure they have images
      const visitsWithImages = (visits || []).map(visit => ({
        ...visit,
        // Always generate image from city name (visits table has no images)
        image_url: getCityImageUrl(visit.city)
      }));
      
      setTrendingVisits(visitsWithImages.slice(0, 6));

      // Popular plans (with attendee counts)
      const { data: popular, error: popularError } = await supabase.rpc('get_popular_plans_with_attendees');
      if (popularError) throw popularError;
      setPopularPlans((popular || []).slice(0, 6));

      // New plans
      const { data: recent, error: recentError } = await supabase.rpc('get_new_plans');
      if (recentError) throw recentError;
      setNewPlans((recent || []).slice(0, 6));

      // Suggested users
      if (session?.user?.id) {
        const { data: people, error: peopleError } = await supabase.rpc('get_suggested_users', {
          current_user_id: session.user.id,
        });
        if (peopleError) throw peopleError;
        setSuggestedPeople((people || []).slice(0, 6));
      }

      // Category filter (optional RPC)
      if (activeCategory !== 'for you') {
        const { data: filteredPlans, error: filterError } = await supabase.rpc('get_plans_by_category', {
          category: activeCategory,
        });
        if (filterError) throw filterError;
        if (filteredPlans?.length) {
          setPopularPlans(filteredPlans.slice(0, 6));
        }
      }
    } catch (err) {
      console.error('Error fetching home data:', err);
      Alert.alert('Error', 'Failed to load content. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, activeCategory]);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHomeData();
  }, [fetchHomeData]);

  const handleCategoryPress = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
  }, []);

  // Composite key for visits (in case your RPC groups rows)
  const getVisitKey = useCallback((visit: any) => {
    const c = visit.city ?? 'city';
    const s = visit.start_date ?? 'start';
    const e = visit.end_date ?? 'end';
    return `visit-${c}-${s}-${e}`;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAFAFA' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: 'white',
          }}
        >
          {/* Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#7DD3FC',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 20 }}>😊</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Thirdspace</Text>
          </View>

          {/* User Avatar */}
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: '#E0E0E0',
            }}
          >
            {userProfile?.avatar_url ? (
              <Image
                source={{ uri: userProfile.avatar_url }}
                style={{ width: '100%', height: '100%' }}
                onError={() => console.log('Avatar failed to load')}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="person" size={20} color="#999" />
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Bar (placeholder button for now) */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 16, backgroundColor: 'white' }}>
          <Pressable
            onPress={() => Alert.alert('Search', 'Search functionality coming soon!')}
            accessibilityRole="button"
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Ionicons name="search" size={20} color="#999" />
            <Text style={{ fontSize: 16, color: '#999', marginLeft: 8 }}>Search trips</Text>
          </Pressable>
        </View>

        {/* Categories Carousel - Sticky */}
        <View style={{ backgroundColor: 'white', paddingVertical: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {categories.map((category) => (
              <CategoryPill
                key={category.id}
                label={category.label}
                icon={category.icon}
                isActive={activeCategory === category.id}
                onPress={() => handleCategoryPress(category.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Trending Visits */}
        {trendingVisits.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333' }}>Trending Trips</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: '#666', fontSize: 14, marginRight: 6 }}>popular among travelers</Text>
                <Text style={{ fontSize: 16 }}>📈</Text>
              </View>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={trendingVisits}
              keyExtractor={getVisitKey}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <VisitCard visit={item} />}
            />
          </View>
        )}

        {/* Popular Plans */}
        {popularPlans.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333' }}>Popular Plans</Text>
              <Pressable
                onPress={() => Alert.alert('See More', 'Navigate to all popular plans')}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={{ color: '#4A90E2', fontSize: 15, fontWeight: '600' }}>See more ›</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={popularPlans}
              keyExtractor={(item) => `popular-${item.id}`}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <PlanCardHome plan={item as Event & { attendee_count?: number; recent_attendees?: any[] }} />}
            />
          </View>
        )}

        {/* New Plans */}
        {newPlans.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 20,
                marginBottom: 16,
              }}
            >
              <View>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333' }}>New Plans</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ color: '#666', fontSize: 14, marginRight: 6 }}>be one of the first to join</Text>
                  <Text style={{ fontSize: 16 }}>✨</Text>
                </View>
              </View>
              <Pressable
                onPress={() => Alert.alert('See More', 'Navigate to all new plans')}
                accessibilityRole="button"
                hitSlop={8}
                style={{ justifyContent: 'center' }}
              >
                <Text style={{ color: '#4A90E2', fontSize: 15, fontWeight: '600' }}>See more ›</Text>
              </Pressable>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={newPlans}
              keyExtractor={(item) => `new-${item.id}`}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <PlanCardHome plan={item as Event & { attendee_count?: number; recent_attendees?: any[] }} />}
            />
          </View>
        )}

        {/* People You May Like */}
        {suggestedPeople.length > 0 && (
          <View style={{ marginTop: 32, marginBottom: 40 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#333' }}>Travelers you may like</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {suggestedPeople.map((person) => (
                <PersonCard key={`person-${person.id}`} person={person} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty State */}
        {trendingVisits.length === 0 && popularPlans.length === 0 && newPlans.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center', marginTop: 50 }}>
            <Ionicons name="compass-outline" size={64} color="#CCC" />
            <Text
              style={{
                fontSize: 18,
                color: '#666',
                textAlign: 'center',
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              No trips or plans available yet
            </Text>
            <Text style={{ fontSize: 14, color: '#999', textAlign: 'center' }}>
              Start creating your first plan or add an upcoming trip!
            </Text>
            <Pressable
              onPress={() => router.push('/create-plan/name')}
              accessibilityRole="button"
              hitSlop={8}
              style={{
                marginTop: 24,
                backgroundColor: '#4A90E2',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 25,
              }}
            >
              <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Create a Plan</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}