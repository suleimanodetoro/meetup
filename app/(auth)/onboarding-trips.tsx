// app/(auth)/onboarding-trips.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  TextInput,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DatePicker from 'react-native-date-picker';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';

const POPULAR_DESTINATIONS = [
  { city: 'London', country: 'United Kingdom', code: 'GB' },
  { city: 'Paris', country: 'France', code: 'FR' },
  { city: 'Tokyo', country: 'Japan', code: 'JP' },
  { city: 'New York', country: 'United States', code: 'US' },
  { city: 'Barcelona', country: 'Spain', code: 'ES' },
  { city: 'Amsterdam', country: 'Netherlands', code: 'NL' },
  { city: 'Dubai', country: 'United Arab Emirates', code: 'AE' },
  { city: 'Singapore', country: 'Singapore', code: 'SG' },
  { city: 'Bangkok', country: 'Thailand', code: 'TH' },
  { city: 'Rome', country: 'Italy', code: 'IT' },
];

export default function OnboardingTripsScreen() {
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [arrivalDate, setArrivalDate] = useState(null);
  const [departureDate, setDepartureDate] = useState(null);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [showArrivalPicker, setShowArrivalPicker] = useState(false);
  const [showDeparturePicker, setShowDeparturePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredDestinations = searchQuery
    ? POPULAR_DESTINATIONS.filter(dest =>
        dest.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dest.country.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_DESTINATIONS;

  const handleContinue = async () => {
    if (selectedDestination && arrivalDate && departureDate) {
      setLoading(true);
      try {
        // Save the trip to the visits table
        const { error } = await supabase
          .from('visits')
          .insert({
            user_id: session?.user.id,
            city: selectedDestination.city,
            country: selectedDestination.country,
            country_code: selectedDestination.code,
            start_date: arrivalDate.toISOString().split('T')[0],
            end_date: departureDate.toISOString().split('T')[0],
          });

        if (error) throw error;
      } catch (error) {
        console.error('Error saving trip:', error);
      } finally {
        setLoading(false);
      }
    }
    
    // Navigate to location permissions screen
    router.push({
      pathname: '/onboarding-location',
      params: {
        ...params,
        hasTrip: selectedDestination ? 'true' : 'false',
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding-location',
      params: {
        ...params,
        hasTrip: 'false',
      },
    });
  };

  return (
    <LinearGradient
      colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
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
            <Text style={{ fontSize: 16, color: '#666' }}>Skip</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 30 }}>
          {/* Title */}
          <Text style={{
            fontSize: 36,
            fontWeight: 'bold',
            marginBottom: 8,
          }}>
            any upcoming trips?
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: '#666',
            marginBottom: 40,
          }}>
            got a trip planned? add it here to match with other travelers going at the same time! 😎
          </Text>

          {/* Airplane decoration */}
          <View style={{ position: 'absolute', right: 30, top: 100 }}>
            <Text style={{ fontSize: 60 }}>✈️</Text>
          </View>

          {/* Destination Selector */}
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 12,
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
              borderColor: selectedDestination ? '#4A90E2' : '#E0E0E0',
            }}>
            <Text style={{
              fontSize: 16,
              color: selectedDestination ? '#333' : '#9E9E9E',
            }}>
              {selectedDestination 
                ? `${selectedDestination.city}, ${selectedDestination.country}`
                : 'Select destination'}
            </Text>
          </Pressable>

          {/* Date Section */}
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 12,
          }}>
            Date
          </Text>

          {/* Arrival Date */}
          <Pressable
            onPress={() => setShowArrivalPicker(true)}
            style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 16,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 2,
              borderColor: arrivalDate ? '#4A90E2' : '#E0E0E0',
            }}>
            <Text style={{ fontSize: 20 }}>📅</Text>
            <Text style={{
              fontSize: 16,
              color: arrivalDate ? '#333' : '#9E9E9E',
            }}>
              {arrivalDate 
                ? `Arrival: ${arrivalDate.toLocaleDateString()}`
                : 'Arrival Date'}
            </Text>
          </Pressable>

          {/* Departure Date */}
          <Pressable
            onPress={() => setShowDeparturePicker(true)}
            style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 16,
              marginBottom: 30,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 2,
              borderColor: departureDate ? '#4A90E2' : '#E0E0E0',
            }}>
            <Text style={{ fontSize: 20 }}>📅</Text>
            <Text style={{
              fontSize: 16,
              color: departureDate ? '#333' : '#9E9E9E',
            }}>
              {departureDate 
                ? `Departure: ${departureDate.toLocaleDateString()}`
                : 'Departing Date'}
            </Text>
          </Pressable>
        </View>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
          <Pressable
            onPress={handleContinue}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#ccc' : '#4A90E2',
              paddingVertical: 18,
              borderRadius: 30,
              alignItems: 'center',
            }}>
            <Text style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '600',
            }}>
              {loading ? 'Saving...' : 'Continue'}
            </Text>
          </Pressable>
        </View>

        {/* Destination Modal */}
        <Modal
          animationType="slide"
          transparent={false}
          visible={showDestinationModal}
          onRequestClose={() => setShowDestinationModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ flex: 1 }}>
              {/* Modal Header */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 15,
                borderBottomWidth: 1,
                borderBottomColor: '#E0E0E0',
              }}>
                <Text style={{ fontSize: 18, fontWeight: '600' }}>
                  Select Destination
                </Text>
                <Pressable
                  onPress={() => setShowDestinationModal(false)}
                  style={{ padding: 5 }}>
                  <Text style={{ fontSize: 17, color: '#4A90E2', fontWeight: '600' }}>
                    Done
                  </Text>
                </Pressable>
              </View>

              {/* Search Bar */}
              <View style={{
                marginHorizontal: 20,
                marginVertical: 15,
                backgroundColor: '#F5F5F5',
                borderRadius: 12,
                paddingHorizontal: 15,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search city or country"
                  placeholderTextColor="#9E9E9E"
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    fontSize: 16,
                  }}
                />
              </View>

              {/* Destinations List */}
              <FlatList
                data={filteredDestinations}
                keyExtractor={(item) => `${item.city}-${item.code}`}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setSelectedDestination(item);
                      setShowDestinationModal(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 15,
                      paddingHorizontal: 20,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F0F0F0',
                    }}>
                    <Text style={{ fontSize: 20, marginRight: 12 }}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: '500' }}>
                        {item.city}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                        {item.country}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Date Pickers */}
        <DatePicker
          modal
          open={showArrivalPicker}
          date={arrivalDate || new Date()}
          mode="date"
          minimumDate={new Date()}
          onConfirm={(date) => {
            setArrivalDate(date);
            setShowArrivalPicker(false);
            // Auto-set departure date if not set
            if (!departureDate) {
              const nextWeek = new Date(date);
              nextWeek.setDate(nextWeek.getDate() + 7);
              setDepartureDate(nextWeek);
            }
          }}
          onCancel={() => setShowArrivalPicker(false)}
        />

        <DatePicker
          modal
          open={showDeparturePicker}
          date={departureDate || (arrivalDate ? new Date(arrivalDate.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date())}
          mode="date"
          minimumDate={arrivalDate || new Date()}
          onConfirm={(date) => {
            setDepartureDate(date);
            setShowDeparturePicker(false);
          }}
          onCancel={() => setShowDeparturePicker(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}