// ~/hooks/useNearbyEvents.ts
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { NearbyEvent } from '~/types/db';
import { Alert } from 'react-native';
import { supabase } from '~/utils/supabase';

export const useNearbyEvents = () => {
  const [events, setEvents] = useState<NearbyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied ');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  useEffect(() => {
    if (location) {
      fetchNearbyEvents();
    }
  }, [location]);

  const fetchNearbyEvents = async () => {
    if (!location) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('nearby_events', {
        lat: location?.coords.latitude!,
        long: location?.coords.longitude!,
      });

      if (error) {
        console.error('RPC Error:', error);
        setError(error.message);
        setEvents([]);
      } else {
        setEvents(data || []);
      }
    } catch (err) {
      console.error('Unexpected Error:', err);
      setError('Failed to fetch nearby events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Return the state values instead of JSX
  return {
    events,
    loading,
    error,
    refetch: fetchNearbyEvents
  };
};