import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import { View, Text, Image } from 'react-native';

import dayjs from 'dayjs'
const EventListItem = ({event}) => {
  return (
    <View className="gap-3 m-3 pb-3 border-b-2 border-gray-100 ">
      {/* Card Top Section: Texts + Image */}
      <View className="flex-row">
        {/* Event Details */}
        <View className="flex-1 gap-2">
          <Text className="text-lg font-semibold uppercase text-amber-800">
            {dayjs(event.datetime).format('ddd, D, MMM')}· {dayjs(event.datetime).format('h:mm A')}
          </Text>
          <Text className="text-xl font-bold" numberOfLines={2}>
            {event.title}
          </Text>
          <Text className="text-gray-700">{event.location}</Text>
        </View>

        {/* Event Image */}
        <Image
          className="aspect-video w-2/5 rounded-xl"
          source={{ uri: event.image }}
        />
      </View>

      {/* Card Footer: Attendance + Actions */}
      <View className="flex-row gap-3">
        <Text className="mr-auto text-gray-700">16 going</Text>
        <Feather name="share" size={20} color="gray" />
        <Feather name="bookmark" size={20} color="gray" />
      </View>
    </View>
  );
};

export default EventListItem;
