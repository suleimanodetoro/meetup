import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Mapbox, { Camera, MapView } from '@rnmapbox/maps';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VisitDetailsBottomSheet from '~/components/VisitDetailsBottomSheet';
import UpsellModal from '~/components/UpsellModal';
import { useCityOverview } from '~/hooks/useCityOverview';
import { useUpsellTrigger } from '~/hooks/useUpsellTrigger';
import { getCityCoordinates } from '~/utils/geographic';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

/**
 * City-name-keyed city detail screen. Replaces the old visit-id-keyed
 * `/visit/[id]`. Always renders — even for cities with no current
 * visitors or no upcoming plans. The bottom sheet just shows empty
 * lists in those cases.
 */
export default function CityDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const cityName = name ? decodeURIComponent(name) : undefined;
  const insets = useSafeAreaInsets();
  const { overview, users, plans, loading, refetch, error } = useCityOverview(cityName);
  const [activeTab, setActiveTab] = useState<'users' | 'plans'>('users');
  const [cityCoordinates, setCityCoordinates] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [coordsLoading, setCoordsLoading] = useState(false);

  const { showUpsellModal, handleCardVisibility, dismissModal } = useUpsellTrigger();

  // Resolve a map centre for the city; fall back to a generic mid-Atlantic
  // point if the geocoder can't find it.
  useEffect(() => {
    if (!overview?.city) return;
    setCoordsLoading(true);
    getCityCoordinates(overview.city, overview.country_code ?? undefined)
      .then((coords) => setCityCoordinates(coords))
      .catch((err) => {
        console.error('Failed to load coordinates:', err);
        setCityCoordinates({ lat: 50.0, lng: 10.0 });
      })
      .finally(() => setCoordsLoading(false));
  }, [overview?.city, overview?.country_code]);

  if (!cityName) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Missing city name</Text>
        <Pressable onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || coordsLoading || !cityCoordinates) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading {cityName}…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Pressable onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // overview is always non-null here — the RPC returns a single row even
  // when no visits and no plans exist, with empty users/plans arrays.
  const headerVisit = {
    city: overview?.city ?? cityName,
    country: overview?.country ?? null,
    country_code: overview?.country_code ?? null,
  };

  return (
    <View style={styles.container}>
      <MapView style={StyleSheet.absoluteFillObject}>
        <Camera
          centerCoordinate={[cityCoordinates.lng, cityCoordinates.lat]}
          zoomLevel={11}
          animationMode="flyTo"
          animationDuration={2000}
        />
      </MapView>

      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 10 }]}
      >
        <Ionicons name="arrow-back" size={24} color="#000" />
      </Pressable>

      <VisitDetailsBottomSheet
        visit={headerVisit}
        users={users}
        plans={plans}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={refetch}
        onUserCardVisible={handleCardVisibility}
        loading={loading}
      />

      <UpsellModal
        visible={showUpsellModal}
        onDismiss={dismissModal}
        onSubscribe={() => {
          dismissModal();
          router.push('/settings' as never);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorText: { fontSize: 16, color: '#FF3B30', textAlign: 'center', marginBottom: 20 },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  errorButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
