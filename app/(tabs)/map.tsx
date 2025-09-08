// app/(tabs)/map.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import Mapbox, { 
  Camera, 
  MapView, 
  MarkerView,
  PointAnnotation,
} from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { getCountryFlag } from '~/utils/countryFlags';
import { getCityCoordinates } from '~/utils/geographic';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Set Mapbox token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

interface User {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string;
  location_country: string;
  nationality_code: string | null;
  interests: string[] | null;
  gender: string | null;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [userCity, setUserCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [usersInCity, setUsersInCity] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-0.1278, 51.5074]); // Default London

  useEffect(() => {
    loadUserLocationAndFetchUsers();
  }, []);

  const loadUserLocationAndFetchUsers = async () => {
    try {
      // Get current user's stored location from profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('location, location_country, location_country_code')
        .eq('id', session?.user.id)
        .single();

      if (error) throw error;

      if (profile?.location) {
        setUserCity(profile.location);
        setUserCountry(profile.location_country);
        
        // Get coordinates for the city to center map
        const coords = getCityCoordinates(profile.location);
        if (coords) {
          setMapCenter([coords.lng, coords.lat]);
        }

        // Fetch users in the same city
        await fetchUsersInCity(profile.location, profile.location_country);
      } else {
        // No location set, prompt user to set it
        Alert.alert(
          'Set Your Location',
          'Please set your current city to see nearby travelers.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Set Location', onPress: () => detectAndSetLocation() }
          ]
        );
      }
    } catch (error) {
      console.error('Error loading location:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectAndSetLocation = async () => {
    try {
      setLoading(true);
      
      // Request permission if not granted
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to detect your city.');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest, // City-level
      });

      // Reverse geocode to get city
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        const city = place.city || place.district || place.subregion;
        
        if (city) {
          // Update user's location in database
          const { error } = await supabase
            .from('profiles')
            .update({
              location: city,
              location_country: place.country,
              location_country_code: place.isoCountryCode,
              location_updated_at: new Date().toISOString(),
            })
            .eq('id', session?.user.id);

          if (!error) {
            setUserCity(city);
            setUserCountry(place.country || null);
            
            // Get coordinates and center map
            const coords = getCityCoordinates(city);
            if (coords) {
              setMapCenter([coords.lng, coords.lat]);
              cameraRef.current?.setCamera({
                centerCoordinate: [coords.lng, coords.lat],
                zoomLevel: 12,
                animationDuration: 2000,
              });
            }

            // Fetch users in this city
            await fetchUsersInCity(city, place.country);
          }
        }
      }
    } catch (error) {
      console.error('Error detecting location:', error);
      Alert.alert('Error', 'Could not detect your location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersInCity = async (city: string, country: string | null) => {
    try {
      const { data, error } = await supabase.rpc('get_users_in_city', {
        city_name: city,
        country_name: country,
      });

      if (error) throw error;

      setUsersInCity(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      // Search for a city and get its coordinates
      const coords = getCityCoordinates(searchQuery);
      
      if (coords) {
        // Fly to the searched city
        cameraRef.current?.setCamera({
          centerCoordinate: [coords.lng, coords.lat],
          zoomLevel: 12,
          animationDuration: 2000,
        });
        
        // Fetch users in the searched city
        await fetchUsersInCity(searchQuery, null);
      } else {
        // Try geocoding as fallback
        const geocode = await Location.geocodeAsync(searchQuery);
        if (geocode && geocode.length > 0) {
          const { latitude, longitude } = geocode[0];
          
          cameraRef.current?.setCamera({
            centerCoordinate: [longitude, latitude],
            zoomLevel: 12,
            animationDuration: 2000,
          });
        } else {
          Alert.alert('Location not found', 'Please try a different search term.');
        }
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const renderUserCard = (user: User) => (
    <Pressable
      key={user.id}
      style={styles.userCard}
      onPress={() => router.push(`/profile/${user.id}`)}>
      <Image
        source={{ 
          uri: user.avatar_url || 'https://via.placeholder.com/100' 
        }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.full_name}
          </Text>
          {user.nationality_code && (
            <Text style={styles.userFlag}>
              {getCountryFlag(user.nationality_code)}
            </Text>
          )}
        </View>
        <Text style={styles.userLocation} numberOfLines={1}>
          {user.location}
        </Text>
        {user.interests && user.interests.length > 0 && (
          <Text style={styles.userInterests} numberOfLines={1}>
            {user.interests.slice(0, 2).join(' • ')}
          </Text>
        )}
      </View>
    </Pressable>
  );

  // Generate random positions around city center for user markers
  const getRandomOffset = (index: number) => {
    const angle = (index * 137.5) % 360; // Golden angle for better distribution
    const radius = 0.01 + (index * 0.002) % 0.02; // Vary radius
    const latOffset = radius * Math.cos(angle * Math.PI / 180);
    const lngOffset = radius * Math.sin(angle * Math.PI / 180);
    return { latOffset, lngOffset };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView 
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        styleURL={Mapbox.StyleURL.Street}
        compassEnabled
        compassPosition={{ top: 100, right: 20 }}
        logoEnabled={false}
        attributionEnabled={false}>
        
        <Camera
          ref={cameraRef}
          centerCoordinate={mapCenter}
          zoomLevel={12}
          animationMode="flyTo"
          animationDuration={2000}
        />

        {/* User markers distributed around city center */}
        {usersInCity.map((user, index) => {
          const offset = getRandomOffset(index);
          return (
            <MarkerView
              key={user.id}
              coordinate={[
                mapCenter[0] + offset.lngOffset,
                mapCenter[1] + offset.latOffset
              ]}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => setSelectedUser(user)}>
              <Pressable 
                style={styles.markerContainer}
                onPress={() => setSelectedUser(user)}>
                <Image
                  source={{ 
                    uri: user.avatar_url || 'https://via.placeholder.com/50' 
                  }}
                  style={styles.markerAvatar}
                />
                <View style={styles.markerTail} />
              </Pressable>
            </MarkerView>
          );
        })}
      </MapView>

      {/* Search Bar */}
      <SafeAreaView style={[styles.searchContainer, { top: insets.top }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search city..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </Pressable>
          )}
        </View>

        {/* Current City Pill */}
        {userCity && (
          <View style={styles.currentCityPill}>
            <Ionicons name="location" size={14} color="#4A90E2" />
            <Text style={styles.currentCityText}>
              {userCity}, {userCountry}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Bottom Sheet with users */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom }]}>
        <View style={styles.bottomSheetHandle} />
        <Text style={styles.bottomSheetTitle}>
          {usersInCity.length} Travelers in {userCity || 'this city'}
        </Text>
        
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.usersScrollContainer}>
          {usersInCity.length > 0 ? (
            usersInCity.map(renderUserCard)
          ) : (
            <View style={styles.noUsersContainer}>
              <Text style={styles.noUsersText}>
                No travelers found in {userCity || 'this city'}
              </Text>
              <Text style={styles.noUsersSubtext}>
                Be the first to explore here!
              </Text>
            </View>
          )}
        </ScrollView>

        {usersInCity.length > 0 && (
          <Pressable 
            style={styles.seeAllButton}
            onPress={() => router.push('/search-users')}>
            <Text style={styles.seeAllButtonText}>
              See all {usersInCity.length} Nearby Travelers
            </Text>
          </Pressable>
        )}
      </View>

      {/* Selected User Popup */}
      {selectedUser && (
        <Pressable 
          style={styles.selectedUserOverlay}
          onPress={() => setSelectedUser(null)}>
          <View style={styles.selectedUserCard}>
            <Pressable 
              style={styles.closeButton}
              onPress={() => setSelectedUser(null)}>
              <Ionicons name="close" size={24} color="#666" />
            </Pressable>
            
            <Image
              source={{ 
                uri: selectedUser.avatar_url || 'https://via.placeholder.com/100' 
              }}
              style={styles.selectedUserAvatar}
            />
            
            <Text style={styles.selectedUserName}>
              {selectedUser.full_name}
            </Text>
            
            <Text style={styles.selectedUserLocation}>
              {selectedUser.location}, {selectedUser.location_country}
            </Text>
            
            {selectedUser.bio && (
              <Text style={styles.selectedUserBio} numberOfLines={3}>
                {selectedUser.bio}
              </Text>
            )}
            
            <Pressable 
              style={styles.viewProfileButton}
              onPress={() => {
                setSelectedUser(null);
                router.push(`/profile/${selectedUser.id}`);
              }}>
              <Text style={styles.viewProfileButtonText}>View Profile</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Set Location Button (if no location) */}
      {!userCity && (
        <Pressable 
          style={styles.setLocationButton}
          onPress={detectAndSetLocation}>
          <Ionicons name="location-outline" size={20} color="white" />
          <Text style={styles.setLocationButtonText}>Set My Location</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  currentCityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentCityText: {
    fontSize: 12,
    color: '#4A90E2',
    marginLeft: 4,
    fontWeight: '600',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'white',
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'white',
    marginTop: -2,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  usersScrollContainer: {
    paddingHorizontal: 20,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 200,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  userFlag: {
    fontSize: 16,
    marginLeft: 4,
  },
  userLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  userInterests: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  noUsersContainer: {
    paddingVertical: 30,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  noUsersText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  noUsersSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  seeAllButton: {
    backgroundColor: '#4A90E2',
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  seeAllButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedUserOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  selectedUserCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
  },
  selectedUserAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 15,
    backgroundColor: '#E0E0E0',
  },
  selectedUserName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  selectedUserLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  selectedUserBio: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  viewProfileButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  viewProfileButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  setLocationButton: {
    position: 'absolute',
    bottom: 180,
    alignSelf: 'center',
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  setLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});