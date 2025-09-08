// app/(auth)/onboarding-location.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';

export default function OnboardingLocationScreen() {
  const params = useLocalSearchParams();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{
    city?: string;
    country?: string;
    countryCode?: string;
  } | null>(null);

  const handleEnableLocation = async () => {
    setLoading(true);
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Denied',
          'You can always enable location later in settings.',
          [{ text: 'OK', onPress: () => navigateNext(false) }]
        );
        return;
      }

      // Get current location (city-level accuracy is fine)
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest, // City-level accuracy
      });

      // Reverse geocode to get city and country
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        const city = place.city || place.district || place.subregion || place.region;
        
        if (city) {
          // Store only city-level location in database
          const { error } = await supabase
            .from('profiles')
            .update({
              location: city,
              location_country: place.country,
              location_country_code: place.isoCountryCode,
              location_updated_at: new Date().toISOString(),
            })
            .eq('id', session?.user.id);

          if (error) {
            console.error('Error saving location:', error);
            Alert.alert('Error', 'Failed to save location. You can update it later in settings.');
          } else {
            // Show success feedback
            setDetectedLocation({
              city: city,
              country: place.country,
              countryCode: place.isoCountryCode,
            });
          }
        } else {
          Alert.alert(
            'Location Detection Issue',
            'Could not determine your city. You can set it manually in settings.',
            [{ text: 'OK', onPress: () => navigateNext(true) }]
          );
        }
      }

      // Navigate to next screen after a brief delay to show location
      setTimeout(() => navigateNext(true), 1500);

    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(
        'Location Error',
        'Unable to detect your location. You can set it manually later.',
        [{ text: 'OK', onPress: () => navigateNext(false) }]
      );
    } finally {
      setLoading(false);
    }
  };

  const navigateNext = (locationEnabled: boolean) => {
    router.push({
      pathname: '/onboarding-notifications',
      params: {
        ...params,
        location_enabled: locationEnabled ? 'true' : 'false',
      },
    });
  };

  const handleSkip = () => {
    navigateNext(false);
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
          paddingHorizontal: 20,
          paddingTop: 10,
        }}>
          <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleSkip} style={{ padding: 10 }}>
            <Text style={{ fontSize: 16, color: '#666' }}>Skip</Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          paddingHorizontal: 30,
        }}>
          {/* Icon */}
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 30,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 5,
          }}>
            <Ionicons name="location" size={60} color="#4CAF50" />
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: '#2E7D32',
            marginBottom: 15,
            textAlign: 'center',
          }}>
            Share Your City
          </Text>

          {/* Description */}
          <Text style={{
            fontSize: 16,
            color: '#555',
            textAlign: 'center',
            marginBottom: 10,
            lineHeight: 24,
          }}>
            Connect with travelers in your area
          </Text>

          <Text style={{
            fontSize: 14,
            color: '#777',
            textAlign: 'center',
            marginBottom: 40,
            lineHeight: 20,
          }}>
            We'll detect your current city to help you discover other travelers nearby and local events
          </Text>

          {/* Location Info Display */}
          {detectedLocation && (
            <View style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 20,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={{ 
                marginLeft: 8, 
                fontSize: 14, 
                color: '#2E7D32',
                fontWeight: '600',
              }}>
                {detectedLocation.city}, {detectedLocation.country}
              </Text>
            </View>
          )}

          {/* Enable Button */}
          <Pressable
            onPress={handleEnableLocation}
            disabled={loading || detectedLocation !== null}
            style={{
              backgroundColor: loading || detectedLocation ? '#B0BEC5' : '#4CAF50',
              paddingHorizontal: 50,
              paddingVertical: 16,
              borderRadius: 30,
              marginBottom: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
              minWidth: 250,
              alignItems: 'center',
            }}>
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : detectedLocation ? (
              <Text style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '600',
              }}>
                Location Saved ✓
              </Text>
            ) : (
              <Text style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '600',
              }}>
                Detect My City
              </Text>
            )}
          </Pressable>

          {/* Privacy Note */}
          <Text style={{
            fontSize: 12,
            color: '#999',
            textAlign: 'center',
            marginTop: 10,
            paddingHorizontal: 20,
          }}>
            We only store your city, not your exact location
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}