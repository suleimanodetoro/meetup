import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COUNTRIES } from '~/utils/countryFlags';
import type { StepBodyProps } from '../types';

type Country = (typeof COUNTRIES)[number];

export interface NationalityValue {
  code: string;
  name: string;
}

export function NationalityField({
  value,
  setValue,
}: StepBodyProps<NationalityValue>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return COUNTRIES;
    const q = query.toLowerCase();
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const selectedFlag = value
    ? COUNTRIES.find((c) => c.code === value.code)?.flag
    : undefined;

  return (
    <>
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
        Your country
      </Text>
      <Pressable
        style={{
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: value ? '#007AFF' : '#E0E0E0',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
        onPress={() => setModalOpen(true)}
      >
        <Text style={{ fontSize: 16 }}>🔍</Text>
        {value ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 24 }}>{selectedFlag}</Text>
            <Text style={{ fontSize: 18, color: '#333' }}>{value.name}</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 16, color: '#9E9E9E' }}>
            Select your country
          </Text>
        )}
      </Pressable>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalOpen}
        onRequestClose={() => setModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 15,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0',
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#1A1A1A' }}>
              Select your country
            </Text>
            <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
              <Text
                style={{ fontSize: 17, color: '#007AFF', fontWeight: '600' }}
              >
                Done
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              marginHorizontal: 20,
              marginVertical: 15,
              backgroundColor: '#F5F5F5',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries..."
              placeholderTextColor="#999"
              autoFocus
              style={{ flex: 1, fontSize: 16, color: '#1A1A1A' }}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={({ item }: { item: Country }) => (
              <CountryRow
                item={item}
                selected={value?.code === item.code}
                onPress={() => {
                  setValue({ code: item.code, name: item.name });
                  setModalOpen(false);
                  setQuery('');
                }}
              />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function CountryRow({
  item,
  selected,
  onPress,
}: {
  item: Country;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: selected ? '#F0F7FF' : 'white',
      }}
    >
      <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag}</Text>
      <Text
        style={{
          fontSize: 17,
          color: '#1A1A1A',
          fontWeight: selected ? '600' : '400',
          flex: 1,
        }}
      >
        {item.name}
      </Text>
      {selected ? (
        <Text style={{ fontSize: 17, color: '#007AFF' }}>✓</Text>
      ) : null}
    </Pressable>
  );
}
