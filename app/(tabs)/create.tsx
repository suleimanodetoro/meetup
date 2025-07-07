// ~/screens/CreateEvent.js
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View, TextInput, Button, Pressable, Alert, ScrollView } from 'react-native';
import DatePicker from 'react-native-date-picker';

import Avatar from '~/components/Avatar';

import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import AddressAutocomplete from '~/components/AddressAutocomplete';

export default function CreateEvent() {
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [imageUrl, setImageUrl] = useState('');
  const [location, setLocation] = useState(null)

  const [loading, setLoading] = useState(false);

  const { user } = useAuth();

  const createEvent = async () => {
    setLoading(true);
    const long = location.features[0].geometry.coordinates[0];
    const lat = location.features[0].geometry.coordinates[1]

    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          title,
          description,
          date: date.toISOString(),
          user_id: user.id,
          image_uri: imageUrl,
          location: location.features[0].properties.name,
          location_point: `POINT(${long} ${lat})`,
        },
      ])
      .select()
      .single();

    if (error) {
      Alert.alert('Failed to create the event', error.message);
    } else {
      setTitle('');
      setDescription('');
      setDate(new Date());
      console.log(data);
      router.push(`/event/${data.id}`);
    }

    setLoading(false);
  };

  return (
    <View className="flex-1 bg-white">
      {/* Fixed: Wrapped content in ScrollView */}
      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="items-center mb-3">
          <Avatar
            size={200}
            url={imageUrl}
            onUpload={(url: string) => {
              setImageUrl(url);
            }}
          />
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          className="rounded-md border border-gray-200 p-3 mb-3"
        />
        
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          multiline
          numberOfLines={3}
          className="min-h-32 rounded-md border border-gray-200 p-3 mb-3"
        />

        <Text className="rounded-md border border-gray-200 p-3 mb-3" onPress={() => setOpen(true)}>
          {date.toLocaleString()}
        </Text>

        <DatePicker
          modal
          open={open}
          date={date}
          minimumDate={new Date()}
          minuteInterval={15}
          onConfirm={(date) => {
            setOpen(false);
            setDate(date);
          }}
          onCancel={() => {
            setOpen(false);
          }}
        />
        
        <AddressAutocomplete onSelected={(location)=> setLocation(location)}/>
      </ScrollView>

      {/* Fixed: Moved button outside ScrollView with absolute positioning */}
      <View className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-200">
        <Pressable
          onPress={() => createEvent()}
          disabled={loading}
          className="items-center rounded-md bg-red-500 p-3 px-8">
          <Text className="text-lg font-bold text-white">Create event</Text>
        </Pressable>
      </View>
    </View>
  );
}