// app/visit/[id].tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Pressable, Text, ActivityIndicator } from 'react-native';
import Mapbox, { Camera, MapView } from '@rnmapbox/maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import VisitDetailsBottomSheet from '~/components/VisitDetailsBottomSheet';
import UpsellModal from '~/components/UpsellModal';
import { useVisitDetails } from '~/hooks/useVisitDetails';
import { useUpsellTrigger } from '~/hooks/useUpsellTrigger';
import { getCityCoordinates } from '~/utils/geographic';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

export default function VisitDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { visit, users, plans, loading, refetch, error } = useVisitDetails(id);
  const [activeTab, setActiveTab] = useState<'users' | 'plans'>('users');
  const [cityCoordinates, setCityCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsLoading, setCoordsLoading] = useState(false);
  
  const {
    showUpsellModal,
    handleCardVisibility,
    dismissModal,
    resetTrigger
  } = useUpsellTrigger();

  // Fetch coordinates when visit data loads
  useEffect(() => {
    if (visit?.city) {
      setCoordsLoading(true);
      getCityCoordinates(visit.city, visit.country_code)
        .then(coords => {
          console.log('Coordinates loaded for', visit.city, coords);
          setCityCoordinates(coords);
        })
        .catch(err => {
          console.error('Failed to load coordinates:', err);
          // Fallback to a default location
          setCityCoordinates({ lat: 50.0, lng: 10.0 });
        })
        .finally(() => setCoordsLoading(false));
    }
  }, [visit?.city, visit?.country_code]);

  // Show loading state
  if (loading || coordsLoading || !cityCoordinates) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading visit details...</Text>
      </View>
    );
  }

  // Show error state
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

  // If no visit found after loading
  if (!visit) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Visit not found</Text>
        <Pressable onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Background Map */}
      <MapView style={StyleSheet.absoluteFillObject}>
        <Camera
          centerCoordinate={[cityCoordinates.lng, cityCoordinates.lat]}
          zoomLevel={11}
          animationMode="flyTo"
          animationDuration={2000}
        />
      </MapView>

      {/* Back Button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + 10 }]}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </Pressable>

      {/* Bottom Sheet with Visit Details */}
      <VisitDetailsBottomSheet
        visit={visit}
        users={users}
        plans={plans}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRefresh={refetch}
        onCardVisibility={handleCardVisibility}
      />

      {/* Upsell Modal */}
      <UpsellModal
        visible={showUpsellModal}
        onDismiss={dismissModal}
        onUpgrade={() => {
          dismissModal();
          router.push('/settings/subscription');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
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