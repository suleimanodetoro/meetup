import Feather from '@expo/vector-icons/Feather';
import { View, Text, Image, Pressable } from 'react-native';
import dayjs from 'dayjs';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '~/utils/supabase';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  image_uri: string;
}

interface EventListItemProps {
  event: Event;
}

const EventListItem = ({ event }: EventListItemProps) => {
  const [numberOfAttendees, setNumberOfAttendees] = useState(0);
  useEffect(() => {
    if (event?.id) {
      fetchNumberOfAttendees();
    }
  }, [event?.id]);

  const fetchNumberOfAttendees = async () => {
    const { count, error } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id);
      if (error) {
        console.error('Failed to count attendees:', error.message);
        return;
      }
      setNumberOfAttendees(count || 0);
  };

  return (
    <Link href={`/${event.id}`} asChild>
      <Pressable className="m-3 gap-3 border-b-2 border-gray-100 pb-3">
        <View className="flex-row">
          <View className="flex-1 gap-2">
            <Text className="text-lg font-semibold uppercase text-amber-800">
              {dayjs(event.date).format('ddd, D MMM')} · {dayjs(event.date).format('h:mm A')}
            </Text>
            <Text className="text-xl font-bold" numberOfLines={2}>
              {event.title}
            </Text>
            <Text className="text-gray-700">{event.location}</Text>
          </View>

          <Image className="aspect-video w-2/5 rounded-xl" source={{ uri: event.image_uri }} />
        </View>

        <View className="flex-row gap-3">
        <Text className="mr-auto text-gray-700">{numberOfAttendees} going</Text>

          <Feather name="share" size={20} color="gray" />
          <Feather name="bookmark" size={20} color="gray" />
        </View>
      </Pressable>
    </Link>
  );
};

export default EventListItem;
