// components/EventCard.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Link } from 'expo-router';
import SupaImage from './SupaImage';
import { Event } from '~/types/db';
import dayjs from 'dayjs';

type EventCardProps = {
  event: Event;
};

const EventCard = ({ event }: EventCardProps) => {
  return (
    <Link href={`/event/${event.id}`} asChild>
      <Pressable style={{ width: 280, marginRight: 16 }}>
        <SupaImage
          path={event.image_uri}
          className="w-full h-32 rounded-lg bg-gray-200"
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
