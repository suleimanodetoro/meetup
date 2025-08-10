// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { supabase } from '~/utils/supabase';
import { Event } from '~/types/db';
import EventCard from '../../components/EventCard';
import TrendingCityCard from '../../components/TrendingCityCard';
import { useAuth } from '../contexts/AuthProvider';

export default function HomeScreen() {
  const [trendingCities, setTrendingCities] = useState([]);
  const [popularPlans, setPopularPlans] = useState<Event[]>([]);
  const [nearbyEvents, setNearbyEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    setLoading(true);
    try {
      // Fetch trending cities
      const { data: cities, error: citiesError } = await supabase.rpc('get_trending_cities');
      if (!citiesError && cities) {
        setTrendingCities(cities || []);
      }

      // Fetch popular plans
      const { data: plans, error: plansError } = await supabase.rpc('get_popular_plans');
      if (!plansError && plans) {
        setPopularPlans(plans || []);
      }

      // Fetch regular events for "Near You" section (fallback if no location)
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!eventsError && events) {
        setNearbyEvents(events || []);
      }
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#e91e63" />
        </View>
      </SafeAreaView>
    );
  }

  const userEmail = session?.user?.email;
  const userName = userEmail ? userEmail.split('@')[0] : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ padding: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 4 }}>
            Welcome back{userName ? `, ${userName}` : ''}!
          </Text>
          <Text style={{ color: 'gray', fontSize: 16 }}>Discover amazing plans near you</Text>
        </View>

        {/* Trending Cities Section */}
        {trendingCities.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <View
              style={{
                paddingHorizontal: 20,
                marginBottom: 12,
              }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Trending Cities</Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={trendingCities}
              keyExtractor={(item) => item.city}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <TrendingCityCard city={item} />}
            />
          </View>
        )}

        {/* Popular Plans Section */}
        {popularPlans.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <View
              style={{
                paddingHorizontal: 20,
                marginBottom: 12,
              }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Popular Plans</Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={popularPlans}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <EventCard event={item} />}
            />
          </View>
        )}

        {/* Near You Section */}
        {nearbyEvents.length > 0 && (
          <View style={{ marginTop: 30, marginBottom: 30 }}>
            <View
              style={{
                paddingHorizontal: 20,
                marginBottom: 12,
              }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Recent Events</Text>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={nearbyEvents}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => <EventCard event={item} />}
            />
          </View>
        )}

        {/* Empty state if no data */}
        {trendingCities.length === 0 && popularPlans.length === 0 && nearbyEvents.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center', marginTop: 50 }}>
            <Text style={{ fontSize: 18, color: 'gray', textAlign: 'center' }}>
              No events available yet. Create your first event!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}