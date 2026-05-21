import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { getCountryFlag } from '~/utils/countryFlags';

interface ExplorePlan {
  id: number;
  title: string | null;
  description?: string | null;
  date: string | null;
  end_date?: string | null;
  city: string | null;
  country?: string | null;
  country_code?: string | null;
  image_uri?: string | null;
  interests?: string[] | null;
  attendee_count?: number;
  recent_attendees?: { id?: string; avatar_url?: string | null }[];
}

/** Stable list of country filter pills. Order matters; no shuffle. */
const COUNTRY_PILLS: readonly { code: string; label: string; flag: string }[] = [
  { code: 'GB', label: 'UK', flag: '🇬🇧' },
  { code: 'US', label: 'USA', flag: '🇺🇸' },
  { code: 'FR', label: 'France', flag: '🇫🇷' },
  { code: 'ES', label: 'Spain', flag: '🇪🇸' },
  { code: 'IT', label: 'Italy', flag: '🇮🇹' },
  { code: 'JP', label: 'Japan', flag: '🇯🇵' },
  { code: 'TH', label: 'Thailand', flag: '🇹🇭' },
  { code: 'DE', label: 'Germany', flag: '🇩🇪' },
];

const ExplorePlanCard = React.memo(({ plan }: { plan: ExplorePlan }) => {
  const formatDateRange = (startDate: string | null, endDate?: string | null) => {
    if (!startDate) return '';
    // Parse YYYY-MM-DD as local to avoid UTC-midnight drift one day earlier
    // in negative-UTC zones.
    const parseLocal = (s: string) => {
      const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
      return isNaN(d.getTime()) ? null : d;
    };
    const start = parseLocal(startDate);
    if (!start) return '';
    const end = endDate ? parseLocal(endDate) : null;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (!end || startDate === endDate) {
      return `${monthNames[start.getMonth()]} ${start.getDate()}`;
    }
    if (start.getMonth() === end.getMonth()) {
      return `${monthNames[start.getMonth()]} ${start.getDate()} - ${end.getDate()}`;
    }
    return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}`;
  };

  const attendeeCount = plan.attendee_count ?? 0;
  const flag = plan.country_code ? getCountryFlag(plan.country_code) : '';

  return (
    <Pressable
      onPress={() => router.push(`/event/${plan.id}` as never)}
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
        <View style={{ width: 124, height: 124 }}>
          {plan.image_uri ? (
            <Image source={{ uri: plan.image_uri }} style={{ width: '100%', height: '100%' }} />
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
              <Ionicons name="calendar-outline" size={36} color="#9CA3AF" />
            </View>
          )}
        </View>

        <View style={{ flex: 1, padding: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 4 }}>
            {plan.title}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={{ fontSize: 14, color: '#6B7280', marginLeft: 4 }}>
              {formatDateRange(plan.date, plan.end_date)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            {flag ? <Text style={{ fontSize: 15, marginRight: 6 }}>{flag}</Text> : null}
            <Text style={{ fontSize: 14, color: '#6B7280' }}>
              {plan.city || 'Location'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', marginRight: 8 }}>
              {plan.recent_attendees?.slice(0, 3).map((attendee, index) => (
                <View
                  key={attendee?.id ?? index}
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
              {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});
ExplorePlanCard.displayName = 'ExplorePlanCard';

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
    {icon ? <Text style={{ fontSize: 16, marginRight: 6 }}>{icon}</Text> : null}
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
FilterPill.displayName = 'FilterPill';

/** YYYY-MM-DD for "today, local" — for use with postgres DATE columns. */
function todayLocalDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>(
    typeof params.filter === 'string' ? params.filter : 'trending',
  );
  const [plans, setPlans] = useState<ExplorePlan[]>([]);

  const fetchPlans = useCallback(async () => {
    try {
      const trimmedQuery = searchQuery.trim();

      let data: ExplorePlan[] | null = null;
      let error: { message: string } | null = null;

      // 1) Search mode: query events directly by city or title across the
      //    entire upcoming-events set, ignoring the active filter pill.
      if (trimmedQuery.length > 0) {
        const escaped = trimmedQuery.replace(/[%_]/g, (m) => `\\${m}`);
        const r = await supabase
          .from('events')
          .select(
            'id, title, description, date, end_date, city, country, country_code, image_uri, interests',
          )
          .or(`city.ilike.%${escaped}%,title.ilike.%${escaped}%`)
          .gte('date', todayLocalDate())
          .order('date', { ascending: true })
          .limit(50);
        data = (r.data as unknown as ExplorePlan[]) ?? null;
        error = r.error;
      }
      // 2) Trending / popular / new — server-side RPCs, ordered + capped.
      else if (activeFilter === 'trending' || activeFilter === 'popular') {
        const r = await supabase.rpc('get_popular_plans_with_attendees');
        data = (r.data as unknown as ExplorePlan[]) ?? null;
        error = r.error;
      } else if (activeFilter === 'new') {
        const r = await supabase.rpc('get_new_plans');
        data = (r.data as unknown as ExplorePlan[]) ?? null;
        error = r.error;
      }
      // 3) Country filter — direct events query by country_code.
      else {
        const country = COUNTRY_PILLS.find((c) => c.code === activeFilter);
        if (country) {
          const r = await supabase
            .from('events')
            .select(
              'id, title, description, date, end_date, city, country, country_code, image_uri, interests',
            )
            .eq('country_code', country.code)
            .gte('date', todayLocalDate())
            .order('date', { ascending: true })
            .limit(50);
          data = (r.data as unknown as ExplorePlan[]) ?? null;
          error = r.error;
        } else {
          // Unknown filter — fall back to trending.
          const r = await supabase.rpc('get_popular_plans_with_attendees');
          data = (r.data as unknown as ExplorePlan[]) ?? null;
          error = r.error;
        }
      }

      if (error) throw error;
      setPlans(data ?? []);
    } catch (err) {
      console.error('Error fetching plans:', err);
      setPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      void fetchPlans();
    }, searchQuery.trim() ? 250 : 0); // debounce typed queries
    return () => clearTimeout(handle);
  }, [fetchPlans, searchQuery]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchPlans();
  }, [fetchPlans]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={{ backgroundColor: 'white', paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>Explore Plans</Text>
        </View>

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
              placeholder="Search by city or plan title"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 16,
                color: '#111827',
              }}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Filter pills are hidden while a search is active — search runs
            against the whole upcoming events set, not the filtered subset. */}
        {searchQuery.trim().length === 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
          >
            <FilterPill
              label="Trending"
              icon="🔥"
              isActive={activeFilter === 'trending'}
              onPress={() => setActiveFilter('trending')}
            />
            <FilterPill
              label="New"
              icon="👋"
              isActive={activeFilter === 'new'}
              onPress={() => setActiveFilter('new')}
            />
            {COUNTRY_PILLS.map((country) => (
              <FilterPill
                key={country.code}
                label={country.label}
                icon={country.flag}
                isActive={activeFilter === country.code}
                onPress={() => setActiveFilter(country.code)}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={plans}
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
              {searchQuery.trim()
                ? `Nothing matches "${searchQuery.trim()}" in upcoming plans`
                : 'Try a different filter'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
