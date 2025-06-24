import { Stack } from 'expo-router';
import Entypo from '@expo/vector-icons/Entypo';
import Feather from '@expo/vector-icons/Feather';
import { View, Text, Image } from 'react-native';
import EventListItem from '~/components/EventListItem';


export default function Home() {
  return (
    <>
      {/* Screen header */}
      <Stack.Screen options={{ title: 'Events' }} />
      <EventListItem />
      <EventListItem />

      
    </>
  );
}
