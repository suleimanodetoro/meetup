import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import { View, Text, Image } from 'react-native';

const EventListItem = () => {
  return (
    <View className="gap-3 p-3">
      {/* Card Top Section: Texts + Image */}
      <View className="flex-row">
        {/* Event Details */}
        <View className="flex-1 gap-2">
          <Text className="text-lg font-semibold uppercase text-amber-800">
            Tue, 8 July · 17:30 BST
          </Text>
          <Text className="text-xl font-bold" numberOfLines={2}>
            Karaoke
          </Text>
          <Text className="text-gray-700">Leeds City Centre</Text>
        </View>

        {/* Event Image */}
        <Image
          className="aspect-video w-2/5 rounded-xl"
          source={{ uri: 'https://notjustdev-dummy.s3.us-east-2.amazonaws.com/images/1.jpg' }}
        />
      </View>

      {/* Card Footer: Attendance + Actions */}
      <View className="flex-row gap-3">
        <Text className="mr-auto text-gray-700">16 going</Text>
        <Feather name="share" size={24} color="gray" />
        <Feather name="bookmark" size={24} color="gray" />
      </View>
    </View>
  );
};

export default EventListItem;
