// components/EventCard.tsx
import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Link } from 'expo-router';
import { Event } from '~/types/db';
import dayjs from 'dayjs';

type EventCardProps = {
  event: Event;
};

const EventCard = ({ event }: EventCardProps) => {
  // Debug log to verify URL
  console.log('Event image URL:', event.image_uri);
  
  return (
    <Link href={`/event/${event.id}`} asChild>
      <Pressable style={{ width: 280, marginRight: 16 }}>
        <Image
          source={{ 
            uri: event.image_uri || 'https://placehold.co/280x128/e91e63/white?text=No+Image' 
          }}
          style={{
            width: '100%',
            height: 128,
            borderRadius: 8,
            backgroundColor: '#e0e0e0',
          }}
          resizeMode="cover"
          defaultSource={{ 
            uri: 'https://placehold.co/280x128/e0e0e0/white?text=Loading' 
          }}
        />
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              color: '#e91e63',
              fontWeight: '600',
              textTransform: 'uppercase',
              fontSize: 12,
            }}>
            {dayjs(event.date).format('ddd, MMM D')} · {dayjs(event.date).format('h:mm A')}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={{ color: 'gray', marginTop: 4 }}>
            {event.city}, {event.country_code}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
};

export default EventCard;