import Feather from '@expo/vector-icons/Feather';
import { View, Text, Image, Pressable } from 'react-native';
import dayjs from 'dayjs';
import { Link } from 'expo-router';

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
  return (
    <Link href={`/${event.id}`} asChild>
      <Pressable className="gap-3 m-3 pb-3 border-b-2 border-gray-100">
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

          <Image
            className="aspect-video w-2/5 rounded-xl"
            source={{ uri: event.image_uri }}
          />
        </View>

        <View className="flex-row gap-3">
          <Text className="mr-auto text-gray-700">16 going</Text>
          <Feather name="share" size={20} color="gray" />
          <Feather name="bookmark" size={20} color="gray" />
        </View>
      </Pressable>
    </Link>
  );
};

export default EventListItem;