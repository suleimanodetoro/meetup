// app/create-plan/destinations.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import StepperProgress from '~/components/StepperProgress';
import { useCreatePlan } from '~/contexts/CreatePlanContext';
import { getSuggestions, retrieveDetails } from '~/utils/AddressAutocomplete';
import { useAuth } from '~/contexts/AuthProvider';

interface VenueData {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
}

export default function DestinationsScreen() {
  const { formData, updateField, nextStep, canContinue, setStep } = useCreatePlan();
  const { session } = useAuth();
  const [venues, setVenues] = useState<VenueData[]>(formData.venues);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    updateField('venues', venues);
  }, [venues]);

  // 1) Auto-search with 300ms debounce
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  useEffect(() => {
  setStep(5);
}, [setStep]);

  // 2) Updated handleSearch with type filtering + better result handling
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const data = await getSuggestions(
        searchQuery,
        session?.access_token || 'session-' + Date.now(),
        {
          // Filter to actual locations
          types: ['place', 'poi', 'address'],
          // Optional country bias:
          // country: ['NG'],
        }
      );

      const results = (data?.suggestions || [])
        .filter((s: any) =>
          ['place', 'poi', 'address', 'locality'].includes(s.feature_type)
        )
        .sort((a: any, b: any) => {
          const queryLower = searchQuery.toLowerCase();
          const aNameMatch = a.name?.toLowerCase().includes(queryLower) ? 1 : 0;
          const bNameMatch = b.name?.toLowerCase().includes(queryLower) ? 1 : 0;
          return bNameMatch - aNameMatch;
        });

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search venues');
    } finally {
      setSearching(false);
    }
  };

  // 3) Optional: proximity biasing (lng,lat) if user location is known
  const handleSearchWithProximity = async (userLat?: number, userLng?: number) => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const options: any = { types: ['place', 'poi', 'address'] };
      if (userLat && userLng) {
        // Mapbox expects "lng,lat"
        options.proximity = `${userLng},${userLat}`;
      }

      const data = await getSuggestions(
        searchQuery,
        session?.access_token || 'session-' + Date.now(),
        options
      );

      setSearchResults(data?.suggestions || []);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search venues');
    } finally {
      setSearching(false);
    }
  };

  const addVenue = async (venue: any) => {
    if (venues.length >= 3) {
      Alert.alert('Limit Reached', 'You can add up to 3 destinations');
      return;
    }

    setSearching(true);
    try {
      // Retrieve full details to get coordinates
      const details = await retrieveDetails(
        venue.mapbox_id,
        session?.access_token || 'session-' + Date.now()
      );

      const feature = details.features?.[0];
      if (!feature) {
        throw new Error('No details found');
      }

      const newVenue: VenueData = {
        name: venue.name || feature.properties?.name,
        address: venue.place_formatted || feature.properties?.place_formatted,
        city:
          venue.context?.place?.name ||
          feature.properties?.context?.place?.name,
        country:
          venue.context?.country?.name ||
          feature.properties?.context?.country?.name,
        country_code:
          venue.context?.country?.country_code ||
          feature.properties?.context?.country?.country_code,
        lat: feature.geometry?.coordinates?.[1], // GeoJSON = [lng, lat]
        lng: feature.geometry?.coordinates?.[0],
      };

      setVenues([...venues, newVenue]);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error retrieving venue details:', error);
      Alert.alert('Error', 'Failed to get venue details');
    } finally {
      setSearching(false);
    }
  };

  const removeVenue = (index: number) => {
    setVenues(venues.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    if (canContinue()) {
      nextStep();
      router.push('/create-plan/interests');
    }
  };

  const getCountryFlag = (code?: string) => {
    const flags: Record<string, string> = {
      GB: '🇬🇧',
      US: '🇺🇸',
      FR: '🇫🇷',
      IE: '🇮🇪',
      DE: '🇩🇪',
      ES: '🇪🇸',
      IT: '🇮🇹',
    };
    return flags[code || ''] || '🌍';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>Create Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress */}
      <StepperProgress currentStep={5} totalSteps={9} />

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>Destinations</Text>
          <Text style={styles.subtitle}>You can add up to 3 destinations</Text>

          {/* Add Destination Button */}
          <Pressable
            onPress={() => setShowSearch(true)}
            disabled={venues.length >= 3}
            style={[
              styles.addButton,
              venues.length >= 3 && styles.addButtonDisabled,
            ]}
          >
            <View style={styles.addIcon}>
              <Text style={styles.addIconText}>+</Text>
            </View>
            <Text style={styles.addButtonText}>Add Destination</Text>
          </Pressable>

          {/* Venues List */}
          {venues.map((venue, index) => (
            <View key={index} style={styles.venueCard}>
              <View style={styles.venueFlag}>
                <Text style={styles.flagEmoji}>
                  {getCountryFlag(venue.country_code)}
                </Text>
              </View>
              <View style={styles.venueInfo}>
                <Text style={styles.venueName}>{venue.name}</Text>
                <Text style={styles.venueAddress}>
                  {venue.city && venue.country
                    ? `${venue.city}, ${venue.country}`
                    : venue.address}
                </Text>
              </View>
              <Pressable
                onPress={() => removeVenue(index)}
                style={styles.removeButton}
              >
                <Ionicons name="close" size={20} color="#666" />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          disabled={venues.length === 0}
          style={[
            styles.continueButton,
            venues.length === 0 && styles.continueButtonDisabled,
          ]}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
      </View>

      {/* Search Modal */}
      <Modal visible={showSearch} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowSearch(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Add Destination</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for a venue or location"
              placeholderTextColor="#999"
              style={styles.searchInput}
              onSubmitEditing={handleSearch}
              autoFocus
            />
          </View>

          {/* Results */}
          {searching && searchResults.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading venue details...</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.mapbox_id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => addVenue(item)}
                  style={styles.searchResult}
                  disabled={searching}
                >
                  <View style={styles.resultIcon}>
                    <Ionicons name="location" size={20} color="#666" />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultAddress}>
                      {item.place_formatted}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                searchQuery && !searching ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No results found</Text>
                  </View>
                ) : null
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  headerSpacer: { width: 32 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  addButtonDisabled: { opacity: 0.5 },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addIconText: { fontSize: 20, color: '#007AFF' },
  addButtonText: { fontSize: 16, color: '#333', fontWeight: '500' },
  venueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  venueFlag: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flagEmoji: { fontSize: 24 },
  venueInfo: { flex: 1 },
  venueName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  venueAddress: { fontSize: 14, color: '#666' },
  removeButton: { padding: 8 },
  footer: { paddingHorizontal: 24, paddingBottom: 34 },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonDisabled: { backgroundColor: '#C8D7E8' },
  continueButtonText: { color: 'white', fontSize: 17, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: 'white' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  cancelButton: { fontSize: 16, color: '#007AFF' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16 },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 16, fontWeight: '500', color: '#333', marginBottom: 4 },
  resultAddress: { fontSize: 14, color: '#666' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
});
