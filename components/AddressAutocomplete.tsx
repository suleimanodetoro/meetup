// ~/components/AddressAutocomplete.js
import { View, Text, TextInput, ScrollView, Pressable } from 'react-native';
import React, { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getSuggestions, retrieveDetails } from '~/utils/AddressAutocomplete';
import { useAuth } from '~/app/contexts/AuthProvider';

const AddressAutocomplete = ({onSelected}) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState();

  const {session} = useAuth();
  

  const search = async () => {

    const data = await getSuggestions(input,session?.access_token);
    setSuggestions(data.suggestions);
  };

  const onSuggestionClick = async (suggestion) => {
    setSelectedLocation(suggestion);
    setInput(suggestion.name);
    // Clear suggestions after selection
    setSuggestions([]);

    // retrive coordinate through details
    const details = await retrieveDetails(suggestion.mapbox_id, session?.access_token)
    onSelected(details)
  }

  return (
    <View className="p-2">
      <View className="flex flex-row gap-3 items-center mb-2">
        <TextInput
          value={input}  // Added this line - the key fix!
          onChangeText={setInput}
          placeholder="Location"
          className="rounded-md border border-gray-200 p-3 flex-1"
        />
        <FontAwesome onPress={search} name="search" size={24} color="black" />
      </View>

      {/* Fixed: Added maxHeight and nestedScrollEnabled */}
      <ScrollView 
        className='gap-2' 
        style={{ maxHeight: 200 }}
        nestedScrollEnabled={true}
      >
        {suggestions.map((item, index) => (
          <Pressable onPress={() => onSuggestionClick(item)} key={item.mapbox_id || index} className="rounded-md border border-gray-300 p-3">
            <Text className="font-semibold">{item.name}</Text>
            <Text className="text-xs text-gray-500">{item.place_formatted}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

export default AddressAutocomplete;