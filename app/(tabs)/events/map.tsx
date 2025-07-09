// app/(tabs)/events/map.tsx
import Mapbox, { MapView, Camera, LocationPuck, ShapeSource, SymbolLayer, Images } from '@rnmapbox/maps';
import { featureCollection, point } from '@turf/helpers';
import { View, ActivityIndicator, Text } from 'react-native';
import { useNearbyEvents } from '~/hooks/useNearbyEvents';
import PinIcon from '~/assets/pin.png'; 
import { router } from 'expo-router';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

export default function EventsMapView() {
  const { events, loading, error } = useNearbyEvents();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#ef4444" />
        <Text className="mt-4 text-lg">Loading events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="mb-4 text-center text-lg text-red-500">Error: {error}</Text>
      </View>
    );
  }

  const points = events.filter((event) => event.long && event.lat).map((event) => 
    point([event.long, event.lat], { event })
  );

  return (
    <View style={{ flex: 1 }}>
      <MapView 
        style={{ flex: 1 }}
        styleURL={Mapbox.StyleURL.Street}
      >
        <Camera followZoomLevel={14} followUserLocation />
        <LocationPuck puckBearingEnabled puckBearing="heading" pulsing={{ isEnabled: true }} />
{/* what if there are multiple events at a location, say time squre? how to handle this better?  */}
        <ShapeSource id="events" shape={featureCollection(points)} onPress={(event)=>
            router.push(`/event/${event.features[0].properties.event.id}`)
        }>

          <SymbolLayer
            id="event-icons"
            filter={[]}
            style={{
              iconImage: 'pin',
              iconSize: 1,
              iconAllowOverlap: true,
              iconAnchor: 'bottom',
            }}
          />
          <Images images={{pin:PinIcon}} />
        </ShapeSource>
      </MapView>
    </View>
  );
}