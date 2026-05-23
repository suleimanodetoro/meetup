import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { LANGUAGES } from '~/utils/constants';
import type { StepBodyProps } from '../types';

type Language = (typeof LANGUAGES)[number];

export function LanguagesField({
  value,
  setValue,
}: StepBodyProps<string[]>) {
  const [query, setQuery] = useState('');
  const selected = value ?? ['en'];

  const filtered = useMemo(() => {
    if (!query) return LANGUAGES;
    const q = query.toLowerCase();
    return LANGUAGES.filter((l) => l.name.toLowerCase().includes(q));
  }, [query]);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      if (selected.length === 1) return; // keep at least one
      setValue(selected.filter((c) => c !== code));
    } else {
      setValue([...selected, code]);
    }
  };

  return (
    <>
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 16,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: '#F0F0F0',
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search languages..."
          placeholderTextColor="#999"
          style={{ flex: 1, paddingVertical: 14, fontSize: 16 }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={({ item }: { item: Language }) => (
          <LanguageRow
            item={item}
            selected={selected.includes(item.code)}
            onToggle={() => toggle(item.code)}
          />
        )}
        scrollEnabled={false}
      />
    </>
  );
}

function LanguageRow({
  item,
  selected,
  onToggle,
}: {
  item: Language;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: selected ? '#E3F2FD' : 'white',
        marginBottom: 8,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: selected ? '#007AFF' : '#F0F0F0',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: selected ? '#007AFF' : '#F5F5F5',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        <Text style={{ fontSize: 20 }}>{item.flag}</Text>
      </View>
      <Text
        style={{
          fontSize: 17,
          flex: 1,
          color: '#333',
          fontWeight: selected ? '600' : '400',
        }}
      >
        {item.name}
      </Text>
      {selected ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#007AFF',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 14, color: 'white' }}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
