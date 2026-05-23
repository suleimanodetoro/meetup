// ~/components/AddressAutocomplete.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getSuggestions, retrieveDetails } from '~/utils/AddressAutocomplete';
import { useAuth } from '~/app/contexts/AuthProvider';

interface Suggestion {
  mapbox_id: string;
  name: string;
  place_formatted?: string;
}

interface AddressAutocompleteProps {
  onSelected: (details: unknown) => void;
}

const AddressAutocomplete = ({ onSelected }: AddressAutocompleteProps) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const { session } = useAuth();

  const search = async () => {
    const token = session?.access_token;
    if (!token) return;
    const data = await getSuggestions(input, token);
    setSuggestions((data?.suggestions as Suggestion[]) ?? []);
  };

  const onSuggestionClick = async (suggestion: Suggestion) => {
    const token = session?.access_token;
    if (!token) return;
    setInput(suggestion.name);
    setSuggestions([]);
    const details = await retrieveDetails(suggestion.mapbox_id, token);
    onSelected(details);
  };

  return (
    <View className="p-2">
      <View className="flex flex-row gap-3 items-center mb-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Location"
          className="rounded-md border border-gray-200 p-3 flex-1"
        />
        <FontAwesome onPress={search} name="search" size={24} color="black" />
      </View>

      <ScrollView
        className="gap-2"
        style={{ maxHeight: 200 }}
        nestedScrollEnabled
      >
        {suggestions.map((item, index) => (
          <Pressable
            onPress={() => onSuggestionClick(item)}
            key={item.mapbox_id || index}
            className="rounded-md border border-gray-300 p-3"
          >
            <Text className="font-semibold">{item.name}</Text>
            <Text className="text-xs text-gray-500">
              {item.place_formatted}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

export default AddressAutocomplete;
