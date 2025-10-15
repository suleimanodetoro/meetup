// app/(auth)/onboarding-trips.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Modal,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DatePicker from 'react-native-date-picker';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { getSuggestions } from '~/utils/AddressAutocomplete';

interface Destination {
  city: string;
  country: string;
  country_code: string;
  flag: string;
}

// Helper to get country flag from country code
const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export default function OnboardingTripsScreen() {
  const params = useLocalSearchParams();
  const { session, refreshOnboardingStatus } = useAuth();

  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  // Search cities using Mapbox API
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300); // Debounce

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const data = await getSuggestions(
        searchQuery,
        session?.access_token || 'session-' + Date.now(),
        { types: ['place', 'locality'] } // Only cities/towns
      );

      // Filter and format results
      const cityResults = (data.suggestions || [])
        .filter((s: any) => s.feature_type === 'place' || s.feature_type === 'locality')
        .map((suggestion: any) => ({
          city: suggestion.name,
          country: suggestion.context?.country?.name || 'Unknown',
          country_code: suggestion.context?.country?.country_code || 'XX',
          flag: getCountryFlag(suggestion.context?.country?.country_code || 'XX'),
          full_address: suggestion.place_formatted,
        }));

      setSearchResults(cityResults);
    } catch (error) {
      console.error('Search error:', error);
      // Don't show error to user, just clear results
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedDestination || !startDate || !endDate) {
      Alert.alert('Missing Info', 'Please select a destination and dates');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('visits').insert({
        user_id: session?.user.id,
        city: selectedDestination.city,
        country: selectedDestination.country,
        country_code: selectedDestination.country_code,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      if (error) throw error;

      await refreshOnboardingStatus();
      router.push({
        pathname: '/onboarding-location',
        params: { ...params, hasTrip: 'true' },
      });
    } catch (error) {
      console.error('Error saving trip:', error);
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding-location',
      params: { ...params, hasTrip: 'false' },
    });
  };

  const canContinue = selectedDestination && startDate && endDate;

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 10,
          }}>
          <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
            <Text style={{ fontSize: 30 }}>←</Text>
          </Pressable>
          <Pressable onPress={handleSkip} style={{ padding: 10 }}>
            <Text style={{ fontSize: 16, color: '#666', fontWeight: '600' }}>Skip</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 30 }}>
          {/* Title */}
          <Text
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              marginBottom: 8,
              color: '#1A1A1A',
            }}>
            any upcoming trips?
          </Text>

          <Text
            style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 40,
              lineHeight: 24,
            }}>
            got a visit planned? add it here to match with other people going to the same place!
          </Text>

          {/* Destination Selector */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 12,
              color: '#1A1A1A',
            }}>
            Destination
          </Text>
          <Pressable
            onPress={() => setShowDestinationModal(true)}
            style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 16,
              marginBottom: 30,
              borderWidth: 2,
              borderColor: selectedDestination ? '#007AFF' : '#E0E0E0',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}>
            <Text
              style={{
                fontSize: 16,
                color: selectedDestination ? '#1A1A1A' : '#9E9E9E',
                fontWeight: selectedDestination ? '500' : '400',
              }}>
              {selectedDestination
                ? `${selectedDestination.flag} ${selectedDestination.city}, ${selectedDestination.country}`
                : 'Where are you going?'}
            </Text>
          </Pressable>

          {/* Date Pickers */}
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 12,
              color: '#1A1A1A',
            }}>
            Travel Dates
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
            {/* Start Date */}
            <Pressable
              onPress={() => setShowStartDatePicker(true)}
              style={{
                flex: 1,
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: startDate ? '#007AFF' : '#E0E0E0',
              }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>From</Text>
              <Text
                style={{
                  fontSize: 16,
                  color: startDate ? '#1A1A1A' : '#9E9E9E',
                  fontWeight: startDate ? '500' : '400',
                }}>
                {startDate
                  ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Start date'}
              </Text>
            </Pressable>

            {/* End Date */}
            <Pressable
              onPress={() => setShowEndDatePicker(true)}
              style={{
                flex: 1,
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: endDate ? '#007AFF' : '#E0E0E0',
              }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>To</Text>
              <Text
                style={{
                  fontSize: 16,
                  color: endDate ? '#1A1A1A' : '#9E9E9E',
                  fontWeight: endDate ? '500' : '400',
                }}>
                {endDate
                  ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'End date'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 40 }}>
          <Pressable
            onPress={handleContinue}
            disabled={!canContinue || loading}
            style={{
              backgroundColor: canContinue && !loading ? '#007AFF' : '#BDBDBD',
              paddingVertical: 18,
              borderRadius: 30,
              alignItems: 'center',
              shadowColor: '#007AFF',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: loading ? 0 : 0.3,
              shadowRadius: 12,
              elevation: loading ? 0 : 4,
            }}>
            <Text
              style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '600',
              }}>
              {loading ? 'Saving...' : 'Continue'}
            </Text>
          </Pressable>
        </View>

        {/* Destination Search Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={showDestinationModal}
          onRequestClose={() => setShowDestinationModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
            {/* Modal Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 15,
                borderBottomWidth: 1,
                borderBottomColor: '#E0E0E0',
              }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>
                Select Destination
              </Text>
              <Pressable onPress={() => setShowDestinationModal(false)} style={{ padding: 5 }}>
                <Text style={{ fontSize: 17, color: '#007AFF', fontWeight: '600' }}>Done</Text>
              </Pressable>
            </View>

            {/* Search Bar */}
            <View
              style={{
                marginHorizontal: 20,
                marginVertical: 15,
                backgroundColor: '#F5F5F5',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search any city..."
                placeholderTextColor="#999"
                autoFocus
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: '#1A1A1A',
                }}
              />
              {searching && <ActivityIndicator size="small" color="#007AFF" />}
            </View>

            {/* Search Results */}
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.city}-${item.country_code}-${index}`}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedDestination({
                      city: item.city,
                      country: item.country,
                      country_code: item.country_code,
                      flag: item.flag,
                    });
                    setShowDestinationModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={{
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F0F0F0',
                    backgroundColor:
                      selectedDestination?.city === item.city &&
                      selectedDestination?.country_code === item.country_code
                        ? '#F0F7FF'
                        : 'white',
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '600', color: '#1A1A1A' }}>
                        {item.city}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                        {item.country}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={() => (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  {searchQuery.trim().length === 0 ? (
                    <Text
                      style={{
                        fontSize: 16,
                        color: '#999',
                        textAlign: 'center',
                        paddingHorizontal: 40,
                      }}>
                      Start typing to search for any city in the world
                    </Text>
                  ) : searching ? (
                    <ActivityIndicator size="large" color="#007AFF" />
                  ) : (
                    <Text style={{ fontSize: 16, color: '#999' }}>No cities found</Text>
                  )}
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>

        {/* Date Pickers */}
        <DatePicker
          modal
          open={showStartDatePicker}
          date={startDate || new Date()}
          mode="date"
          minimumDate={new Date()}
          onConfirm={(date) => {
            setStartDate(date);
            setShowStartDatePicker(false);
            // Auto-open end date picker if not set
            if (!endDate) {
              setTimeout(() => setShowEndDatePicker(true), 300);
            }
          }}
          onCancel={() => setShowStartDatePicker(false)}
          title="Select start date"
        />

        <DatePicker
          modal
          open={showEndDatePicker}
          date={
            endDate ||
            (startDate ? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date())
          }
          mode="date"
          minimumDate={startDate || new Date()}
          onConfirm={(date) => {
            setEndDate(date);
            setShowEndDatePicker(false);
          }}
          onCancel={() => setShowEndDatePicker(false)}
          title="Select end date"
        />
      </SafeAreaView>
    </LinearGradient>
  );
}
