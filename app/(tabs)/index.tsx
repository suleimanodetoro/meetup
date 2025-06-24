import { Stack } from 'expo-router';
import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import { View, Text, Image, FlatList } from 'react-native';
import EventListItem from '~/components/EventListItem';

import events from '~/assets/events.json';

export default function Home() {
  return (
    <>
      {/* Screen header */}
      <Stack.Screen options={{ title: 'Events' }} />
      {/* List of event items */}
      <FlatList
        data={events}
        className='bg-white'
        renderItem={({ item }) => <EventListItem event={item} />}
        keyExtractor={(item) => item.id}
      />
    </>
  );
}
