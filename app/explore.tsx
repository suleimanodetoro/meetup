// app/explore.tsx - STANDALONE SCREEN, NOT A TAB!
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuth } from './contexts/AuthProvider';
import { getCountryFlag } from '~/utils/countryFlags';
import type { Event } from '~/types/db';

// Plan Card Component for Explore Screen
const ExplorePlanCard = React.memo(({ plan }: { plan: any }) => {
  const formatDateRange = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (!end || startDate === endDate) {
      return `${monthNames[start.getMonth()]} ${start.getDate()}`;
    }
    
    if (start.getMonth() === end.getMonth()) {
      return `${monthNames[start.getMonth()]} ${start.getDate()} - ${end.getDate()}`;
    }
    
    return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}`;
  };

  const getCountryFromCity = (city: string): string => {
    const cityCountryMap: Record<string, string> = {
      'Madrid': '🇪🇸',
      'Bangkok': '🇹🇭',
      'Tokyo': '🇯🇵',
      'London': '🇬🇧',
      'Paris': '🇫🇷',
      'New York': '🇺🇸',
      'Barcelona': '🇪🇸',
      'Rome': '🇮🇹',
      'Milan': '🇮🇹',
      'Dubai': '🇦🇪',
      'Singapore': '🇸🇬',
    };
    return cityCountryMap[city] || '';
  };

  return (
    <Pressable
      onPress={() => router.push(`/event/${plan.id}`)}
      style={{
        backgroundColor: 'white',
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        {/* Image */}
        <View style={{ width: 124, height: 124 }}>
          {plan.image_uri ? (
            <Image
              source={{ uri: plan.image_uri }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <View
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#E5E7EB',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 40 }}>{plan.interests?.[0] === 'beach' ? '🏖️' : '🌆'}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1, padding: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
            {plan.title}
          </Text>
          
          {/* Date Range */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={{ fontSize: 14, color: '#6B7280', marginLeft: 4 }}>
              {formatDateRange(plan.date, plan.end_date)}
            </Text>
          </View>
          
          {/* Location with flag */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 15, marginRight: 6 }}>
              {getCountryFromCity(plan.city) || getCountryFlag(plan.country_code)}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              {plan.city || 'Location'}
            </Text>
          </View>
          
          {/* Attendees */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Avatar Stack */}
            <View style={{ flexDirection: 'row', marginRight: 8 }}>
              {plan.recent_attendees?.slice(0, 3).map((attendee: any, index: number) => (
                <View
                  key={attendee?.id || index}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: 'white',
                    backgroundColor: '#F3F4F6',
                    marginLeft: index > 0 ? -8 : 0,
                    overflow: 'hidden',
                  }}
                >
                  {attendee?.avatar_url ? (
                    <Image
                      source={{ uri: attendee.avatar_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="person" size={12} color="#999" />
                    </View>
                  )}
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              {plan.attendee_count || 0}+ Travelers
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// Filter Pill Component
const FilterPill = React.memo(({
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
    style={{
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isActive ? '#111827' : 'white',
      borderWidth: 1,
      borderColor: isActive ? '#111827' : '#E0E0E0',
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 8,
    }}
  >
    {icon && <Text style={{ fontSize: 16, marginRight: 6 }}>{icon}</Text>}
    <Text
      style={{
        fontSize: 14,
        fontWeight: '500',
        color: isActive ? 'white' : '#6B7280',
      }}
    >
      {label}
    </Text>
  </Pressable>
));

export default function ExploreScreen() {
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(params.filter || 'trending');
  const [plans, setPlans] = useState<any[]>([]);

  // Generate random country filters
  const countryFilters = useMemo(() => {
    const allCountries = [
      { code: 'ES', label: 'Spain', flag: '🇪🇸' },
      { code: 'IT', label: 'Italy', flag: '🇮🇹' },
      { code: 'US', label: 'USA', flag: '🇺🇸' },
      { code: 'GB', label: 'UK', flag: '🇬🇧' },
      { code: 'FR', label: 'France', flag: '🇫🇷' },
      { code: 'JP', label: 'Japan', flag: '🇯🇵' },
      { code: 'TH', label: 'Thailand', flag: '🇹🇭' },
      { code: 'AE', label: 'UAE', flag: '🇦🇪' },
      { code: 'SG', label: 'Singapore', flag: '🇸🇬' },
      { code: 'NL', label: 'Netherlands', flag: '🇳🇱' },
    ];
    
    // Shuffle and pick 4 random countries
    const shuffled = [...allCountries].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      let data = [];
      let error = null;

      // Fetch based on active filter
      if (activeFilter === 'trending' || activeFilter === 'popular') {
        ({ data, error } = await supabase.rpc('get_popular_plans_with_attendees'));
      } else if (activeFilter === 'new') {
        ({ data, error } = await supabase.rpc('get_new_plans'));
      } else {
        // Country filter
        const country = countryFilters.find(c => c.code === activeFilter);
        if (country) {
          ({ data, error } = await supabase
            .from('events')
            .select('*, profiles!events_user_id_fkey(full_name, avatar_url)')
            .eq('country_code', country.code)
            .gte('date', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(20));
        } else {
          // Default to all plans
          ({ data, error } = await supabase.rpc('get_popular_plans_with_attendees'));
        }
      }

      if (error) throw error;

      // Transform data to consistent format
      const transformedPlans = (data || []).map((plan: any) => ({
        ...plan,
        attendee_count: plan.attendee_count || Math.floor(Math.random() * 200) + 50,
        recent_attendees: plan.recent_attendees || [],
      }));

      setPlans(transformedPlans);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, countryFilters]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlans();
  }, [fetchPlans]);

  const handleFilterPress = (filterId: string) => {
    setActiveFilter(filterId);
  };

  const filteredPlans = useMemo(() => {
    if (!searchQuery.trim()) return plans;
    
    const query = searchQuery.toLowerCase();
    return plans.filter(plan => 
      plan.title?.toLowerCase().includes(query) ||
      plan.city?.toLowerCase().includes(query) ||
      plan.description?.toLowerCase().includes(query)
    );
  }, [plans, searchQuery]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ backgroundColor: 'white', paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>Explore Plans</Text>
        </View>
        
        {/* Search Bar */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F3F4F6',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              placeholder="Search All Plans"
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 16,
                color: '#111827',
              }}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
        >
          <FilterPill
            label="Trending"
            icon="🔥"
            isActive={activeFilter === 'trending'}
            onPress={() => handleFilterPress('trending')}
          />
          <FilterPill
            label="New"
            icon="👋"
            isActive={activeFilter === 'new'}
            onPress={() => handleFilterPress('new')}
          />
          {countryFilters.map((country) => (
            <FilterPill
              key={country.code}
              label={country.label}
              icon={country.flag}
              isActive={activeFilter === country.code}
              onPress={() => handleFilterPress(country.code)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Plans List */}
      <FlatList
        data={filteredPlans}
        keyExtractor={(item) => `plan-${item.id}`}
        renderItem={({ item }) => <ExplorePlanCard plan={item} />}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
            <Text style={{ fontSize: 18, color: '#6B7280', marginTop: 16 }}>
              No plans found
            </Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>
              Try adjusting your filters or search
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}