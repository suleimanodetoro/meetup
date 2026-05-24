import { useEffect, useMemo, useState } from 'react';
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
 * City-name-keyed city detail. URL: /city/<name>?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Both window params are optional. When omitted, the underlying RPC defaults
 * to "today → today + 90 days" so the screen still renders sensibly.
 */
function isValidDateString(s: string | undefined): s is string {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00`).getTime());
}

function formatWindowLabel(from?: string, to?: string): string | null {
  if (!isValidDateString(from) || !isValidDateString(to)) return null;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', opts)} – ${end.getDate()}`;
  }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

export default function CityDetailScreen() {
  const { name, from, to, cc, country } = useLocalSearchParams<{
    name: string;
    from?: string;
    to?: string;
    cc?: string;
    country?: string;
  }>();
  const cityName = name ? decodeURIComponent(name) : undefined;
  const fromParam = isValidDateString(from) ? from : undefined;
  const toParam = isValidDateString(to) ? to : undefined;
  const ccHint = typeof cc === 'string' && cc.length === 2 ? cc.toUpperCase() : undefined;
  const countryHint = typeof country === 'string' ? country : undefined;
  const window = useMemo(
    () => ({ from: fromParam, to: toParam }),
    [fromParam, toParam],
  );

  const insets = useSafeAreaInsets();
  const {
    overview,
    users,
    plans,
    loading,
    refetch,
    error,
    loadMoreUsers,
    loadMorePlans,
    usersLoadingMore,
    plansLoadingMore,
  } = useCityOverview(cityName, window);

  const [activeTab, setActiveTab] = useState<'users' | 'plans'>('users');
  const [cityCoordinates, setCityCoordinates] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [coordsLoading, setCoordsLoading] = useState(false);

  const {
    visible: upsellVisible,
    cardEntered: onPaywallCardEntered,
    cardLeft: onPaywallCardLeft,
    dismiss: dismissUpsell,
  } = useUpsellTrigger();

  const windowLabel = useMemo(
    () => formatWindowLabel(fromParam, toParam),
    [fromParam, toParam],
  );

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

  const headerVisit = {
    city: overview?.city ?? cityName,
    country: overview?.country ?? countryHint ?? null,
    country_code: overview?.country_code ?? ccHint ?? null,
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
        windowLabel={windowLabel}
        users={users}
        plans={plans}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={refetch}
        onPaywallCardEntered={onPaywallCardEntered}
        onPaywallCardLeft={onPaywallCardLeft}
        loading={loading}
        onLoadMoreUsers={loadMoreUsers}
        onLoadMorePlans={loadMorePlans}
        usersLoadingMore={usersLoadingMore}
        plansLoadingMore={plansLoadingMore}
      />

      <UpsellModal visible={upsellVisible} onDismiss={dismissUpsell} />
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
