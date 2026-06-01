import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authColors, authSpace } from '~/utils/authTheme';
import { LANGUAGES } from '~/utils/constants';
import type { StepBodyProps } from '../types';

type Language = (typeof LANGUAGES)[number];

export function LanguagesField({ value, setValue }: StepBodyProps<string[]>) {
  const [query, setQuery] = useState('');
  const selected = value ?? ['en'];

  // Sync the visual default into parent state on mount. Without this the row
  // appears selected but the frame's canContinue gate sees undefined, so
  // Continue stays disabled until the user toggles a second language.
  useEffect(() => {
    if (value === undefined) {
      setValue(['en']);
    }
  }, [value, setValue]);

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
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={authColors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search languages..."
          placeholderTextColor={authColors.placeholder}
          style={styles.searchInput}
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
      style={[styles.languageRow, selected ? styles.languageRowSelected : null]}>
      <View style={[styles.flagWrap, selected ? styles.flagWrapSelected : null]}>
        <Text style={{ fontSize: 20 }}>{item.flag}</Text>
      </View>
      <Text style={styles.languageName}>{item.name}</Text>
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={14} color={authColors.ctaPrimaryText} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    backgroundColor: authColors.surface,
    borderRadius: 18,
    paddingHorizontal: authSpace.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    marginBottom: authSpace.lg,
    gap: authSpace.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: authColors.textPrimary,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: authSpace.lg,
    paddingHorizontal: authSpace.lg,
    backgroundColor: authColors.surface,
    marginBottom: authSpace.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
  },
  languageRowSelected: {
    backgroundColor: authColors.accentSoft,
    borderColor: authColors.accent,
  },
  flagWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: authColors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: authSpace.md,
  },
  flagWrapSelected: {
    backgroundColor: authColors.surface,
  },
  languageName: {
    fontSize: 17,
    flex: 1,
    color: authColors.textPrimary,
    fontWeight: '600',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: authColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
