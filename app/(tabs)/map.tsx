// app/(tabs)/map.tsx
import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import Mapbox, { Camera, MapView, MarkerView } from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { getCountryFlag } from '~/utils/countryFlags';
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

// Mapbox Geocoding API helper
async function geocodeCity(cityName: string): Promise<{ lat: number; lng: number; cityName: string; country: string } | null> {
  try {
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cityName)}.json?types=place&limit=1&access_token=${token}`
    );
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      const cityName = feature.text || feature.place_name.split(',')[0];
      const country = feature.context?.find((c: any) => c.id.includes('country'))?.text || '';
      return { lat, lng, cityName, country };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [userCity, setUserCity] = useState<string | null>(null);
  const [displayCity, setDisplayCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [usersInCity, setUsersInCity] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [hasCheckedLocation, setHasCheckedLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Re-run on every tab focus so changes made in edit-profile (or anywhere
  // else that updates `profiles.location`) are reflected when the user
  // comes back to the map. Tab screens stay mounted across tab switches,
  // so a plain useEffect on [] would only run once at first mount.
  useFocusEffect(
    useCallback(() => {
      loadUserLocationAndCheckForChanges();
    }, [session?.user?.id]),
  );

  const loadUserLocationAndCheckForChanges = async () => {
  try {
    // 1. Get stored location from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('location, location_country, location_country_code')
      .eq('id', session?.user?.id ?? '')
      .single();

    if (error) throw error;

    const storedCity = profile?.location;
    const storedCountry = profile?.location_country;

    // 2. Check device location FIRST
    const { status } = await Location.getForegroundPermissionsAsync();
    
    let currentCity: string | null = null;
    let currentCountry: string | null | undefined = null;
    let currentCountryCode: string | null | undefined = null;
    let currentCoords: { latitude: number; longitude: number } | null = null;

    if (status === 'granted') {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
          timeInterval: 5000,
          distanceInterval: 0,
        });

        currentCoords = location.coords;

        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (reverseGeocode && reverseGeocode.length > 0) {
          const place = reverseGeocode[0];
          currentCity = place.city || place.district || place.subregion;
          currentCountry = place.country;
          currentCountryCode = place.isoCountryCode;
        }
      } catch {
        // Location lookup is best-effort; we fall back to the stored profile
        // location below if reverse-geocoding fails.
      }
    }

    // 3. Decide which location to use
    let displayLocationCity = storedCity;
    let displayLocationCountry = storedCountry;

    // If we have current location and it's different from stored, show alert
    if (currentCity && storedCity && currentCity.toLowerCase() !== storedCity.toLowerCase()) {
      // Use current location immediately, but ask user
      displayLocationCity = currentCity;
      displayLocationCountry = currentCountry;
      
      Alert.alert(
        'Location Changed',
        `We detected you're now in ${currentCity}. Would you like to update your stored location?`,
        [
          { 
            text: 'Keep ' + storedCity, 
            onPress: () => {
              // Revert to stored location
              setUserCity(storedCity);
              setDisplayCity(storedCity);
              setUserCountry(storedCountry);
              
              geocodeCity(storedCity).then(coords => {
                if (coords) {
                  setMapCenter([coords.lng, coords.lat]);
                  setTimeout(() => {
                    cameraRef.current?.setCamera({
                      centerCoordinate: [coords.lng, coords.lat],
                      zoomLevel: 12,
                      animationDuration: 2000,
                    });
                  }, 100);
                }
              });
              
              fetchUsersInCity(storedCity, storedCountry);
            }
          },
          { 
            text: 'Update to ' + currentCity,
            onPress: () => updateLocationInDB(currentCity, currentCountry, currentCountryCode),
            style: 'default'
          }
        ]
      );
    } else if (!storedCity && currentCity) {
      // No stored location but we have current location
      displayLocationCity = currentCity;
      displayLocationCountry = currentCountry;
      
      Alert.alert(
        'Set Your Location',
        `We detected you're in ${currentCity}. Set this as your location?`,
        [
          { text: 'Not Now', style: 'cancel' },
          { 
            text: 'Set Location', 
            onPress: () => updateLocationInDB(currentCity, currentCountry, currentCountryCode)
          }
        ]
      );
    } else if (!storedCity && !currentCity) {
      // No location at all
      Alert.alert(
        'Set Your Location',
        'Please set your current city to see nearby profiles.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Set Location', onPress: () => detectAndSetLocation() }
        ]
      );
    }

    // 4. Set the map to the display location
    if (displayLocationCity) {
      setUserCity(storedCity); // Keep stored location in state
      setDisplayCity(displayLocationCity);
      setUserCountry(displayLocationCountry);
      
      // Use current coords if available, otherwise geocode the city
      if (currentCoords && displayLocationCity === currentCity) {
        setMapCenter([currentCoords.longitude, currentCoords.latitude]);
        setTimeout(() => {
          cameraRef.current?.setCamera({
            centerCoordinate: [currentCoords.longitude, currentCoords.latitude],
            zoomLevel: 12,
            animationDuration: 2000,
          });
        }, 100);
      } else {
        const coords = await geocodeCity(displayLocationCity);
        if (coords) {
          setMapCenter([coords.lng, coords.lat]);
          setTimeout(() => {
            cameraRef.current?.setCamera({
              centerCoordinate: [coords.lng, coords.lat],
              zoomLevel: 12,
              animationDuration: 2000,
            });
          }, 100);
        }
      }
      
      await fetchUsersInCity(displayLocationCity, displayLocationCountry);
    }

    setHasCheckedLocation(true);
  } catch (error) {
    console.error('Error loading location:', error);
  } finally {
    setLoading(false);
  }
};

  const updateLocationInDB = async (city: string, country: string | null | undefined, countryCode: string | null | undefined) => {
    const userId = session?.user?.id;
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          location: city,
          location_country: country,
          location_country_code: countryCode,
          location_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setUserCity(city);
      setDisplayCity(city);
      setUserCountry(country || null);

      const coords = await geocodeCity(city);
      if (coords) {
        setMapCenter([coords.lng, coords.lat]);
        setTimeout(() => {
          cameraRef.current?.setCamera({
            centerCoordinate: [coords.lng, coords.lat],
            zoomLevel: 12,
            animationDuration: 2000,
          });
        }, 100);
      }

      await fetchUsersInCity(city, country || null);
      setIsSearching(false);
    } catch (err) {
      console.error('Error updating location:', err);
      Alert.alert(
        "Couldn't update location",
        'Please try again in a moment.',
      );
    }
  };

  const detectAndSetLocation = async () => {
    try {
      setLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to detect your city.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
      });

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        const city = place.city || place.district || place.subregion;
        
        if (city) {
          await updateLocationInDB(city, place.country, place.isoCountryCode);
        } else {
          Alert.alert('Error', 'Could not determine your city.');
        }
      }
    } catch (error) {
      console.error('Error detecting location:', error);
      Alert.alert('Error', 'Could not detect your location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const returnToHomeLocation = async () => {
    if (!userCity) {
      detectAndSetLocation();
      return;
    }

    setIsSearching(false);
    setDisplayCity(userCity);
    setSearchQuery('');
    
    const coords = await geocodeCity(userCity);
    if (coords) {
      setMapCenter([coords.lng, coords.lat]);
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [coords.lng, coords.lat],
          zoomLevel: 12,
          animationDuration: 1500,
        });
      }, 100);
    }
    
    await fetchUsersInCity(userCity, userCountry);
  };

  const fetchUsersInCity = async (city: string, country: string | null) => {
    try {
      const { data, error } = await supabase.rpc('get_users_in_city', {
        city_name: city,
        country_name: country ?? undefined,
      });

      if (error) throw error;

      setUsersInCity((data || []) as any);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsersInCity([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      setIsSearching(true);
      
      const result = await geocodeCity(searchQuery);
      
      if (result) {
        setDisplayCity(result.cityName);
        setMapCenter([result.lng, result.lat]);
        
        setTimeout(() => {
          cameraRef.current?.setCamera({
            centerCoordinate: [result.lng, result.lat],
            zoomLevel: 12,
            animationDuration: 2000,
          });
        }, 100);
        
        await fetchUsersInCity(result.cityName, result.country);
      } else {
        Alert.alert('Location not found', 'Please try a different search term.');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to search for location.');
    } finally {
      setLoading(false);
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

  // Generate stable random positions
  const getRandomOffset = useCallback((index: number) => {
    const angle = (index * 137.5) % 360;
    const radius = 0.01 + (index * 0.002) % 0.02;
    const latOffset = radius * Math.cos(angle * Math.PI / 180);
    const lngOffset = radius * Math.sin(angle * Math.PI / 180);
    return { latOffset, lngOffset };
  }, []);

  if (loading || !hasCheckedLocation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mapCenter[0] === 0 && mapCenter[1] === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="location-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No location set</Text>
          <Pressable style={styles.setLocationButtonCentered} onPress={detectAndSetLocation}>
            <Text style={styles.setLocationButtonText}>Set My Location</Text>
          </Pressable>
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
        attributionEnabled={false}
        onDidFinishLoadingMap={() => setMapReady(true)}> 
        
        <Camera
          ref={cameraRef}
          centerCoordinate={mapCenter}
          zoomLevel={12}
          animationMode="flyTo"
          animationDuration={2000}
        />

        {mapReady && usersInCity.map((user, index) => {
          const offset = getRandomOffset(index);
          return (
            <MarkerView
              key={user.id}
              coordinate={[
                mapCenter[0] + offset.lngOffset,
                mapCenter[1] + offset.latOffset
              ]}
              anchor={{ x: 0.5, y: 1 }}>
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
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for a city..."
              placeholderTextColor="#999"
              style={styles.searchInput}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </Pressable>
            )}
          </View>
          
          {userCity && !isSearching && (
            <View style={styles.currentCityPill}>
              <Ionicons name="location" size={14} color="#007AFF" />
              <Text style={styles.currentCityText}>{userCity}</Text>
            </View>
          )}

          {isSearching && displayCity && (
            <View style={styles.currentCityPill}>
              <Ionicons name="search" size={14} color="#007AFF" />
              <Text style={styles.currentCityText}>{displayCity}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Users List */}
      {usersInCity.length > 0 && (
        <View style={styles.usersListContainer}>
          <View style={styles.usersListHeader}>
            <Text style={styles.usersListTitle}>
              {usersInCity.length} {usersInCity.length === 1 ? 'person' : 'people'} in {displayCity || userCity}
            </Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.usersListContent}>
            {usersInCity.map(renderUserCard)}
          </ScrollView>
        </View>
      )}

      {/* Empty State */}
      {usersInCity.length === 0 && displayCity && (
        <View style={styles.emptyStateOverlay}>
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateText}>
              No users found in {displayCity}
            </Text>
          </View>
        </View>
      )}

      {/* Compass Button */}
      <Pressable 
        style={[styles.compassButton, { bottom: insets.bottom + (usersInCity.length > 0 ? 200 : 100) }]}
        onPress={returnToHomeLocation}>
        <Ionicons name="navigate" size={24} color={isSearching ? '#007AFF' : '#666'} />
      </Pressable>

      {/* User Detail Modal */}
      {selectedUser && (
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setSelectedUser(null)}>
          <View style={styles.userModal}>
            <Image
              source={{ uri: selectedUser.avatar_url || 'https://via.placeholder.com/120' }}
              style={styles.modalAvatar}
            />
            <Text style={styles.modalName}>{selectedUser.full_name}</Text>
            {selectedUser.bio && (
              <Text style={styles.modalBio} numberOfLines={3}>{selectedUser.bio}</Text>
            )}
            <Pressable
              style={styles.viewProfileButton}
              onPress={() => {
                setSelectedUser(null);
                router.push(`/profile/${selectedUser.id}`);
              }}>
              <Text style={styles.viewProfileText}>View Profile</Text>
            </Pressable>
          </View>
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
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  searchContainer: {
    paddingHorizontal: 20,
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
    color: '#007AFF',
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
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'white',
    marginTop: -1,
  },
  usersListContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  usersListHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  usersListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  usersListContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  userCard: {
    width: 280,
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  userFlag: {
    fontSize: 18,
    marginLeft: 8,
  },
  userLocation: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  userInterests: {
    fontSize: 12,
    color: '#999',
  },
  compassButton: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  setLocationButtonCentered: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 8,
  },
  setLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyStateOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  emptyStateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  userModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  modalAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  modalName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  modalBio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  viewProfileButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
  },
  viewProfileText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});