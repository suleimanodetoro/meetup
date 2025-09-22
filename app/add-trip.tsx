// app/add-trip.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from 'react-native-date-picker';
import { supabase } from '~/utils/supabase';
import { useAuth } from './contexts/AuthProvider';
import { POPULAR_DESTINATIONS } from '~/utils/countryFlags';

export default function AddTripScreen() {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<typeof POPULAR_DESTINATIONS[0] | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDestinationSearch, setShowDestinationSearch] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredDestinations = searchQuery
    ? POPULAR_DESTINATIONS.filter(dest =>
        dest.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dest.country.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_DESTINATIONS;

  const canAddTrip = selectedDestination && startDate && endDate;

  const handleAddTrip = async () => {
    if (!canAddTrip || !session?.user?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('visits')
        .insert({
          user_id: session.user.id,
          city: selectedDestination.city,
          country: selectedDestination.country,
          country_code: selectedDestination.code,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        });

      if (error) throw error;

      Alert.alert('Success', 'Trip added successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error adding trip:', error);
      Alert.alert('Error', error.message || 'Failed to add trip');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: 'white',
        }}>
          <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color="#333" />
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ flex: 1, backgroundColor: 'white', marginTop: 2 }}>
          {/* Title */}
          <View style={{ paddingHorizontal: 30, paddingTop: 30 }}>
            <Text style={{
              fontSize: 32,
              fontWeight: 'bold',
              marginBottom: 40,
            }}>
              Where To?
            </Text>
          </View>

          {/* Destination Input */}
          <View style={{ paddingHorizontal: 30, marginBottom: 20 }}>
            <Pressable
              onPress={() => setShowDestinationSearch(true)}
              style={{
                backgroundColor: '#F5F5F5',
                borderRadius: 16,
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Ionicons name="search" size={20} color="#999" />
              {selectedDestination ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>{selectedDestination.flag}</Text>
                  <Text style={{ fontSize: 16, color: '#333' }}>
                    {selectedDestination.city}, {selectedDestination.country}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 16, color: '#999' }}>Search destination</Text>
              )}
            </Pressable>
          </View>

          {/* When (Dates) */}
          <View style={{ paddingHorizontal: 30, marginBottom: 20 }}>
            <Pressable
              onPress={() => setShowStartDatePicker(true)}
              style={{
                backgroundColor: '#F5F5F5',
                borderRadius: 16,
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Ionicons name="calendar-outline" size={20} color="#999" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: startDate ? '#333' : '#999' }}>
                  {startDate && endDate
                    ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'When'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Add Trip Button */}
        <View style={{
          position: 'absolute',
          bottom: 40,
          right: 30,
        }}>
          <Pressable
            onPress={handleAddTrip}
            disabled={!canAddTrip || saving}
            style={{
              backgroundColor: canAddTrip && !saving ? '#007AFF' : '#E0E0E0',
              paddingVertical: 16,
              paddingHorizontal: 40,
              borderRadius: 30,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={{ fontSize: 20, color: 'white' }}>+</Text>
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Add trip</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Destination Search Modal */}
        <Modal
          visible={showDestinationSearch}
          animationType="slide"
          transparent={false}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F0F0F0',
            }}>
              <Pressable onPress={() => setShowDestinationSearch(false)} style={{ padding: 8 }}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: '600', marginLeft: 16 }}>Select Destination</Text>
            </View>

            {/* Search Bar */}
            <View style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              backgroundColor: 'white',
              borderBottomWidth: 1,
              borderBottomColor: '#F0F0F0',
            }}>
              <View style={{
                backgroundColor: '#F5F5F5',
                borderRadius: 12,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
                <Ionicons name="search" size={20} color="#999" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search city or country"
                  placeholderTextColor="#999"
                  autoFocus
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    fontSize: 16,
                  }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Popular Destinations */}
            {!searchQuery && (
              <View style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                backgroundColor: '#F5F5F5',
              }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#666' }}>
                  POPULAR DESTINATIONS
                </Text>
              </View>
            )}

            {/* Destinations List */}
            <FlatList
              data={filteredDestinations}
              keyExtractor={(item) => `${item.city}-${item.code}`}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedDestination(item);
                    setShowDestinationSearch(false);
                    setSearchQuery('');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F0F0F0',
                    backgroundColor: selectedDestination?.city === item.city ? '#F5F5F5' : 'white',
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{item.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.city}</Text>
                    <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>{item.country}</Text>
                  </View>
                  {selectedDestination?.city === item.city && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={() => (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#999' }}>No destinations found</Text>
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
          onConfirm={(date) => {
            setStartDate(date);
            setShowStartDatePicker(false);
            // Auto-show end date picker
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