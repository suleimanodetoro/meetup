// app/(tabs)/map.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  Dimensions,
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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { getCountryFlag } from '~/utils/countryFlags';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Set Mapbox token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const FLOATING_TAB_BAR_HEIGHT = 64;
const FLOATING_TAB_BAR_GAP = 12;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TRAVELER_CARD_WIDTH = Math.min(132, (SCREEN_WIDTH - 58) / 3);
const TRAVELER_CARD_HEIGHT = 164;

const FILTER_CHIPS = [
  { label: 'Filter', icon: 'options-outline' as const },
  { label: 'Studying Abroad', emoji: '📚' },
  { label: 'Backpacking', emoji: '🎒' },
  { label: 'Foodies', emoji: '🍜' },
] as const;

interface User {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string;
  location_country: string;
  location_country_code: string | null;
  nationality_code: string | null;
  interests: string[] | null;
  gender: string | null;
}

type CurrentUserProfile = Pick<
  User,
  'id' | 'full_name' | 'avatar_url' | 'location_country_code' | 'nationality_code'
>;

// Mapbox Geocoding API helper
async function geocodeCity(
  cityName: string
): Promise<{ lat: number; lng: number; cityName: string; country: string } | null> {
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
  const floatingTabBarClearance =
    Math.max(insets.bottom, 16) + FLOATING_TAB_BAR_HEIGHT + FLOATING_TAB_BAR_GAP;
  const { session } = useAuth();
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [userCity, setUserCity] = useState<string | null>(null);
  const [displayCity, setDisplayCity] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [displayCountry, setDisplayCountry] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);
  const [usersInCity, setUsersInCity] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [hasCheckedLocation, setHasCheckedLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Re-run on every tab focus so current-location changes are reflected
  // when the user comes back to the map. Tab screens stay mounted across
  // tab switches, so a plain useEffect on [] would only run once.
  useFocusEffect(
    useCallback(() => {
      loadUserLocationAndCheckForChanges();
    }, [session?.user?.id])
  );

  const loadUserLocationAndCheckForChanges = async () => {
    try {
      // 1. Get stored location from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(
          'full_name, avatar_url, location, location_country, location_country_code, nationality_code'
        )
        .eq('id', session?.user?.id ?? '')
        .single();

      if (error) throw error;

      if (profile && session?.user?.id) {
        setCurrentUserProfile({
          id: session.user.id,
          full_name: profile.full_name ?? 'You',
          avatar_url: profile.avatar_url ?? null,
          location_country_code: profile.location_country_code ?? null,
          nationality_code: profile.nationality_code ?? null,
        });
      }

      const storedCity = profile?.location ?? null;
      const storedCountry = profile?.location_country ?? null;
      const storedCountryCode = profile?.location_country_code ?? null;

      let currentCity: string | null = null;
      let currentCountry: string | null = null;
      let currentCountryCode: string | null = null;
      let currentCoords: { latitude: number; longitude: number } | null = null;

      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted' && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (permission.status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          currentCoords = location.coords;

          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          if (reverseGeocode && reverseGeocode.length > 0) {
            const place = reverseGeocode[0];
            currentCity = place.city || place.district || place.subregion || place.region || null;
            currentCountry = place.country ?? null;
            currentCountryCode = place.isoCountryCode ?? null;
          }
        }
      } catch (locationError) {
        console.warn(
          'Current location lookup failed; falling back to saved location.',
          locationError
        );
      }

      const activeCity = currentCity ?? storedCity;
      const activeCountry = currentCountry ?? storedCountry;
      const usingDetectedLocation = !!currentCity;

      if (!activeCity) {
        Alert.alert('Set Your Location', 'Please set your current city to see nearby profiles.', [
          { text: 'Later', style: 'cancel' },
          { text: 'Set Location', onPress: () => detectAndSetLocation() },
        ]);
        setHasCheckedLocation(true);
        return;
      }

      if (usingDetectedLocation && session?.user?.id) {
        const storedCityKey = storedCity?.trim().toLowerCase() ?? null;
        const currentCityKey = currentCity?.trim().toLowerCase() ?? null;
        const storedCountryKey = storedCountryCode ?? storedCountry;
        const currentCountryKey = currentCountryCode ?? currentCountry;

        if (storedCityKey !== currentCityKey || storedCountryKey !== currentCountryKey) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              location: currentCity,
              location_country: currentCountry,
              location_country_code: currentCountryCode,
              location_updated_at: new Date().toISOString(),
            })
            .eq('id', session.user.id);

          if (updateError) {
            console.error('Error syncing current location:', updateError);
          }
        }
      }

      setUserCity(activeCity);
      setDisplayCity(activeCity);
      setUserCountry(activeCountry);
      setDisplayCountry(activeCountry);

      if (currentCoords && usingDetectedLocation) {
        setMapCenter([currentCoords.longitude, currentCoords.latitude]);
        setTimeout(() => {
          cameraRef.current?.setCamera({
            centerCoordinate: [currentCoords.longitude, currentCoords.latitude],
            zoomLevel: 12,
            animationDuration: 2000,
          });
        }, 100);
      } else {
        const coords = await geocodeCity(activeCity);
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

      await fetchUsersInCity(activeCity, activeCountry);

      setHasCheckedLocation(true);
    } catch (error) {
      console.error('Error loading location:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLocationInDB = async (
    city: string,
    country: string | null | undefined,
    countryCode: string | null | undefined
  ) => {
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
      setDisplayCountry(country || null);

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
      Alert.alert("Couldn't update location", 'Please try again in a moment.');
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
    setDisplayCountry(userCountry);
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
        setDisplayCountry(result.country || null);
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
      style={styles.travelerCard}
      onPress={() => router.push(`/profile/${user.id}`)}>
      <Image
        source={{
          uri: user.avatar_url || `https://i.pravatar.cc/300?u=${user.id}`,
        }}
        style={styles.travelerImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        locations={[0.35, 0.72, 1]}
        style={styles.travelerGradient}
      />
      {(user.location_country_code || user.nationality_code) && (
        <View style={styles.travelerFlagPill}>
          <Text style={styles.travelerFlag}>
            {getCountryFlag(user.location_country_code || user.nationality_code || '')}
          </Text>
        </View>
      )}
      <View style={styles.travelerInfo}>
        <View style={styles.travelerNameRow}>
          <Text style={styles.travelerName} numberOfLines={1}>
            {firstName(user.full_name)}
          </Text>
          <View style={styles.travelerOnlineDot} />
        </View>
      </View>
    </Pressable>
  );

  const renderCurrentUserMarker = () => {
    const profile = currentUserProfile ?? usersInCity[0];

    return (
      <MarkerView coordinate={mapCenter} anchor={{ x: 0.5, y: 0.5 }}>
        <Pressable
          style={styles.featuredMarker}
          onPress={() => profile && router.push(`/profile/${profile.id}`)}>
          <View style={styles.featuredMarkerHalo} />
          <View style={styles.featuredMarkerImageWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.featuredMarkerImage} />
            ) : (
              <View style={styles.featuredMarkerFallback}>
                <Ionicons name="person" size={38} color="#8A8A8A" />
              </View>
            )}
          </View>
        </Pressable>
      </MarkerView>
    );
  };

  const nearbyTitle =
    usersInCity.length === 1 ? '1 Nearby Traveler' : `${usersInCity.length} Nearby Travelers`;
  const displayLocationLabel = [displayCity || userCity, displayCountry || userCountry]
    .filter(Boolean)
    .join(', ');
  const ctaLabel =
    usersInCity.length > 0
      ? `See all ${usersInCity.length} Nearby Travelers`
      : 'Find Nearby Travelers';

  function firstName(name: string | null | undefined) {
    return name?.trim().split(/\s+/)[0] || 'Traveler';
  }

  function renderFilterChip(chip: (typeof FILTER_CHIPS)[number]) {
    return (
      <Pressable
        key={chip.label}
        style={styles.filterChip}
        onPress={chip.label === 'Filter' ? returnToHomeLocation : undefined}>
        {'icon' in chip ? (
          <Ionicons name={chip.icon} size={16} color="#141414" />
        ) : (
          <Text style={styles.filterEmoji}>{chip.emoji}</Text>
        )}
        <Text style={styles.filterChipText}>{chip.label}</Text>
      </Pressable>
    );
  }

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
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        styleURL={Mapbox.StyleURL.Light}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => setMapReady(true)}>
        <Camera
          ref={cameraRef}
          centerCoordinate={mapCenter}
          zoomLevel={12.4}
          padding={{
            paddingTop: 70,
            paddingBottom: 300,
            paddingLeft: 0,
            paddingRight: 0,
          }}
          animationMode="flyTo"
          animationDuration={2000}
        />

        {mapReady && renderCurrentUserMarker()}
      </MapView>

      <View pointerEvents="none" style={styles.mapWash} />

      <SafeAreaView pointerEvents="box-none" style={styles.topOverlay}>
        <View style={[styles.searchContainer, { paddingTop: insets.top + 12 }]}>
          <View style={[styles.searchBar, isSearching && styles.searchBarSearching]}>
            <Ionicons name="search" size={24} color="#111111" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={displayLocationLabel || 'Search for a city'}
              placeholderTextColor="#111111"
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsContent}>
            {FILTER_CHIPS.map(renderFilterChip)}
          </ScrollView>
        </View>
      </SafeAreaView>

      <View style={[styles.travelersTray, { bottom: floatingTabBarClearance }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.travelersHeader}>
          <Text style={styles.travelersTitle}>{nearbyTitle}</Text>
          <Pressable
            style={styles.seeAllButton}
            onPress={() => router.push('/search-users')}
            disabled={usersInCity.length === 0}>
            <Text style={styles.seeAllText}>See All</Text>
            <Ionicons name="chevron-forward" size={18} color="#1189D8" />
          </Pressable>
        </View>

        {usersInCity.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.travelersListContent}>
            {usersInCity.map(renderUserCard)}
          </ScrollView>
        ) : (
          <View style={styles.emptyTravelers}>
            <Text style={styles.emptyStateText}>No travelers found in {displayCity}</Text>
          </View>
        )}

        <Pressable style={styles.primaryCta} onPress={() => router.push('/search-users')}>
          <LinearGradient
            colors={['#52A5FF', '#0A7BFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryCtaGradient}>
            <Text style={styles.primaryCtaText}>{ctaLabel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
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
    paddingHorizontal: 18,
    zIndex: 10,
  },
  searchBar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 30,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  searchBarSearching: {
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.28)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 14,
    fontSize: 16,
    lineHeight: 20,
    color: '#111111',
    fontWeight: '600',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  mapWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(235, 255, 239, 0.12)',
  },
  filterChipsContent: {
    paddingTop: 12,
    paddingRight: 18,
    gap: 8,
  },
  filterChip: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    paddingHorizontal: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 6,
  },
  filterEmoji: {
    fontSize: 16,
    lineHeight: 18,
  },
  filterChipText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#111111',
    fontWeight: '700',
  },
  featuredMarker: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredMarkerHalo: {
    position: 'absolute',
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  featuredMarkerImageWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFFFFF',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#258DFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 12,
    elevation: 12,
  },
  featuredMarkerImage: {
    width: '100%',
    height: '100%',
  },
  featuredMarkerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  travelersTray: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: 344,
    backgroundColor: 'rgba(246, 255, 248, 0.96)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 18,
  },
  sheetHandle: {
    width: 46,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(21, 28, 38, 0.18)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  travelersHeader: {
    paddingHorizontal: 22,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  travelersTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.25,
    color: '#323843',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 15,
    lineHeight: 19,
    color: '#1189D8',
    fontWeight: '800',
  },
  travelersListContent: {
    paddingHorizontal: 18,
    gap: 14,
  },
  travelerCard: {
    width: TRAVELER_CARD_WIDTH,
    height: TRAVELER_CARD_HEIGHT,
    borderRadius: 15,
    backgroundColor: '#D8DEE7',
    overflow: 'hidden',
  },
  travelerImage: {
    width: '100%',
    height: '100%',
  },
  travelerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  travelerFlagPill: {
    position: 'absolute',
    top: 9,
    left: 9,
    minWidth: 27,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  travelerFlag: {
    fontSize: 18,
    lineHeight: 20,
  },
  travelerInfo: {
    position: 'absolute',
    left: 11,
    right: 9,
    bottom: 11,
  },
  travelerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  travelerName: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  travelerOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2ED573',
  },
  emptyTravelers: {
    minHeight: TRAVELER_CARD_HEIGHT,
    marginHorizontal: 22,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  primaryCta: {
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    marginHorizontal: 22,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryCtaGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
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
});
