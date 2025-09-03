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

// Set Mapbox token
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

export default function VisitDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { visit, users, plans, loading, refetch, error } = useVisitDetails(id);
  const [activeTab, setActiveTab] = useState<'users' | 'plans'>('users');
  
  // Upsell state management
  const {
    showUpsellModal,
    handleCardVisibility,
    dismissModal,
    resetTrigger
  } = useUpsellTrigger();

  // Debug logging
  useEffect(() => {
    console.log('VisitDetailsScreen Debug:', {
      id,
      visit,
      users: users?.length,
      plans: plans?.length,
      loading,
      error
    });
  }, [id, visit, users, plans, loading, error]);

  // Get city coordinates for map
  const cityCoordinates = visit ? getCityCoordinates(visit.city) : { lat: 51.5074, lng: -0.1278 }; // Default to London

  // Show loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
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
  if (!loading && !visit) {
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

      {/* Back Button Overlay */}
      <View style={[styles.backButton, { top: insets.top + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButtonInner}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
      </View>

      {/* Debug Info Overlay (remove in production) */}
      {__DEV__ && (
        <View style={[styles.debugInfo, { top: insets.top + 60 }]}>
          <Text style={styles.debugText}>Visit ID: {id}</Text>
          <Text style={styles.debugText}>City: {visit?.city}</Text>
          <Text style={styles.debugText}>Users: {users?.length || 0}</Text>
          <Text style={styles.debugText}>Plans: {plans?.length || 0}</Text>
        </View>
      )}

      {/* Bottom Sheet - Make sure visit exists */}
      {visit && (
        <VisitDetailsBottomSheet
          visit={visit}
          users={users || []}
          plans={plans || []}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onUserCardVisible={handleCardVisibility}
          loading={false}
          onRefresh={refetch}
        />
      )}

      {/* Upsell Modal */}
      <UpsellModal
        visible={showUpsellModal}
        onDismiss={dismissModal}
        onSubscribe={() => {
          // Navigate to subscription screen (create this if needed)
          // router.push('/subscription');
          dismissModal();
        }}
      />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  debugInfo: {
    position: 'absolute',
    left: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
});