// app/add-trip.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, SafeAreaView, Modal, FlatList,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from 'react-native-date-picker';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { getSuggestions } from '~/utils/AddressAutocomplete';

interface Destination {
  city: string;
  country: string;
  country_code: string;
  flag: string;
}

const getCountryFlag = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export default function AddTripScreen() {
  const { session } = useAuth();

  // --- UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDestinationSearch, setShowDestinationSearch] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Search state
  const [searchResults, setSearchResults] = useState<Destination[]>([]);
  const [searching, setSearching] = useState(false);

  // Keep a stable token for the autocomplete session (only falls back if no auth session)
  const fallbackSessionRef = useRef('session-' + Date.now());

  // Guard against race conditions from overlapping requests
  const lastRequestId = useRef(0);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);

    const requestId = ++lastRequestId.current;
    try {
      const data = await getSuggestions(
        q,
        session?.access_token ?? fallbackSessionRef.current,
        {
          // ✅ these were missing in v2; restores your v1 behavior and English-only results
          types: ['place', 'locality'],
          language: 'en',
        }
      );

      // Ignore out-of-order responses
      if (requestId !== lastRequestId.current) return;

      // Map + dedupe by "city|country_code"
      const seen = new Set<string>();
      const results: Destination[] = (data?.suggestions ?? [])
        .filter((s: any) => s?.feature_type === 'place' || s?.feature_type === 'locality')
        .map((s: any) => {
          const countryName = s?.context?.country?.name || 'Unknown';
          const countryCode = s?.context?.country?.country_code || '';
          return {
            city: s?.name ?? '',
            country: countryName,
            country_code: countryCode,
            flag: getCountryFlag(countryCode),
          } as Destination;
        })
        .filter((d: Destination) => {
          const key = `${d.city}|${d.country_code}`;
          if (seen.has(key) || !d.city) return false;
          seen.add(key);
          return true;
        });

      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
      if (requestId === lastRequestId.current) setSearchResults([]);
    } finally {
      if (requestId === lastRequestId.current) setSearching(false);
    }
  }, [searchQuery, session?.access_token]);

  // Debounce typing
  useEffect(() => {
    const t = setTimeout(handleSearch, 300);
    return () => clearTimeout(t);
  }, [handleSearch]);

  const canAddTrip = selectedDestination && startDate && endDate;

  const handleAddTrip = async () => {
    if (!canAddTrip || !session?.user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('visits')
        .insert({
          user_id: session.user.id,
          city: selectedDestination!.city,
          country: selectedDestination!.country,
          country_code: selectedDestination!.country_code,
          start_date: startDate!.toISOString().split('T')[0],
          end_date: endDate!.toISOString().split('T')[0],
        });
      if (error) throw error;
      Alert.alert('Success', 'Trip added successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error adding trip:', error);
      Alert.alert('Error', error.message || 'Failed to add trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
        }}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>Add a Trip</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={{ flex: 1, padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Plan a visit</Text>
          <Text style={{ fontSize: 16, color: '#666', marginBottom: 32 }}>Add where you're going and when</Text>

          {/* Destination */}
          <Pressable
            onPress={() => setShowDestinationSearch(true)}
            style={{
              backgroundColor: '#F8F9FA', padding: 20, borderRadius: 16, marginBottom: 20,
              borderWidth: 2, borderColor: selectedDestination ? '#007AFF' : '#E8E8E8',
            }}
          >
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Destination</Text>
            <Text style={{ fontSize: 18, fontWeight: '500', color: selectedDestination ? '#000' : '#999' }}>
              {selectedDestination
                ? `${selectedDestination.flag} ${selectedDestination.city}, ${selectedDestination.country}`
                : 'Where are you going?'}
            </Text>
          </Pressable>

          {/* Dates */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
            <Pressable
              onPress={() => setShowStartDatePicker(true)}
              style={{
                flex: 1, backgroundColor: '#F8F9FA', padding: 20, borderRadius: 16, borderWidth: 2,
                borderColor: startDate ? '#007AFF' : '#E8E8E8',
              }}
            >
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>From</Text>
              <Text style={{ fontSize: 16, fontWeight: '500', color: startDate ? '#000' : '#999' }}>
                {startDate ? startDate.toLocaleDateString() : 'Start date'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowEndDatePicker(true)}
              style={{
                flex: 1, backgroundColor: '#F8F9FA', padding: 20, borderRadius: 16, borderWidth: 2,
                borderColor: endDate ? '#007AFF' : '#E8E8E8',
              }}
            >
              <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>To</Text>
              <Text style={{ fontSize: 16, fontWeight: '500', color: endDate ? '#000' : '#999' }}>
                {endDate ? endDate.toLocaleDateString() : 'End date'}
              </Text>
            </Pressable>
          </View>

          {/* Add Button */}
          <Pressable
            onPress={handleAddTrip}
            disabled={!canAddTrip || saving}
            style={{
              backgroundColor: canAddTrip ? '#007AFF' : '#E0E0E0',
              padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 'auto',
            }}
          >
            {saving ? <ActivityIndicator color="white" /> : (
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>Add Trip</Text>
            )}
          </Pressable>
        </View>

        {/* Destination Search Modal */}
        <Modal visible={showDestinationSearch} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', padding: 16,
              borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
            }}>
              <Pressable onPress={() => {
                setShowDestinationSearch(false);
                setSearchQuery('');
                setSearchResults([]); // clear
              }}>
                <Ionicons name="close" size={28} color="#000" />
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: '600', marginLeft: 16 }}>Choose destination</Text>
            </View>

            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 12 }}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search for a city..."
                  placeholderTextColor="#999"
                  style={{ flex: 1, padding: 12, fontSize: 16 }}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </Pressable>
                )}
              </View>
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.city}-${item.country_code || 'xx'}-${index}`}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedDestination(item);
                    setShowDestinationSearch(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 20,
                    backgroundColor: selectedDestination?.city === item.city && selectedDestination?.country_code === item.country_code ? '#F5F5F5' : 'white',
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.city}</Text>
                    <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{item.country}</Text>
                  </View>
                  {selectedDestination?.city === item.city && selectedDestination?.country_code === item.country_code && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={() => (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  {searchQuery.length === 0 ? (
                    <Text style={{ fontSize: 16, color: '#999', textAlign: 'center', paddingHorizontal: 40 }}>
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

        {/* Start Date Picker */}
        <DatePicker
          modal
          open={showStartDatePicker}
          date={startDate || new Date()}
          mode="date"
          minimumDate={new Date()}
          title="Select start date (1 of 2)"
          onConfirm={(date) => {
            setStartDate(date);
            setShowStartDatePicker(false);
            setTimeout(() => setShowEndDatePicker(true), 300);
          }}
          onCancel={() => setShowStartDatePicker(false)}
        />

        {/* End Date Picker */}
        <DatePicker
          modal
          open={showEndDatePicker}
          date={endDate || (startDate ? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date())}
          mode="date"
          minimumDate={startDate || new Date()}
          title="Select end date (2 of 2)"
          onConfirm={(date) => {
            setEndDate(date);
            setShowEndDatePicker(false);
          }}
          onCancel={() => setShowEndDatePicker(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
