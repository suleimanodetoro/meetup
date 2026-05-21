// app/(auth)/onboarding-location.tsx
import React, { useState, useRef } from 'react';
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
  
  // Prevent double navigation
  const hasNavigated = useRef(false);

  const handleEnableLocation = async () => {
    if (hasNavigated.current) return; // Prevent multiple calls
    
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
        setLoading(false);
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
            .eq('id', session?.user?.id ?? '');

          if (error) {
            console.error('Error saving location:', error);
            Alert.alert('Error', 'Failed to save location. You can update it later in settings.');
            setLoading(false);
          } else {
            // Show success feedback
            setDetectedLocation({
              city: city,
              country: place.country ?? undefined,
              countryCode: place.isoCountryCode ?? undefined,
            });
            
            // Navigate after showing success (only once!)
            setTimeout(() => {
              if (!hasNavigated.current) {
                navigateNext(true);
              }
            }, 1500);
          }
        } else {
          Alert.alert(
            'Location Detection Issue',
            'Could not determine your city. You can set it manually in settings.',
            [{ text: 'OK', onPress: () => navigateNext(true) }]
          );
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(
        'Location Error',
        'Unable to detect your location. You can set it manually later.',
        [{ text: 'OK', onPress: () => navigateNext(false) }]
      );
      setLoading(false);
    }
  };

  const navigateNext = (locationEnabled: boolean) => {
    if (hasNavigated.current) return; // Prevent double navigation
    hasNavigated.current = true;
    
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

  const handleContinue = () => {
    navigateNext(true);
  };

  return (
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB', '#90CAF9']}
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
            <Text style={{ fontSize: 30 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleSkip} style={{ padding: 10 }}>
            <Text style={{ fontSize: 16, color: '#666', fontWeight: '600' }}>Skip</Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          paddingHorizontal: 40,
        }}>
          {/* Icon */}
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 32,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
          }}>
            <Ionicons 
              name={detectedLocation ? "checkmark-circle" : "location"} 
              size={60} 
              color={detectedLocation ? "#4CAF50" : "#007AFF"} 
            />
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 32,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 16,
            color: '#1A1A1A',
          }}>
            {detectedLocation 
              ? `You're in ${detectedLocation.city}!` 
              : 'Find people nearby'}
          </Text>

          {/* Subtitle */}
          <Text style={{
            fontSize: 16,
            textAlign: 'center',
            color: '#666',
            lineHeight: 24,
            marginBottom: 48,
            paddingHorizontal: 20,
          }}>
            {detectedLocation
              ? 'Great! We\'ll show you people and plans in your area'
              : 'Let us detect your city to show you nearby travelers and local plans'}
          </Text>

          {/* Action Button */}
          <Pressable
            onPress={detectedLocation ? handleContinue : handleEnableLocation}
            disabled={loading}
            style={{
              backgroundColor: loading || detectedLocation ? '#BDBDBD' : '#007AFF',
              paddingHorizontal: 50,
              paddingVertical: 18,
              borderRadius: 30,
              marginBottom: 20,
              shadowColor: '#007AFF',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: loading || detectedLocation ? 0 : 0.3,
              shadowRadius: 12,
              elevation: loading || detectedLocation ? 0 : 4,
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
                Continue →
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
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
            marginTop: 10,
          }}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#666" />
            <Text style={{
              fontSize: 13,
              color: '#666',
              marginLeft: 8,
              fontWeight: '500',
            }}>
              We only store your city, not exact location
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}