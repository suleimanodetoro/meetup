import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES } from '~/utils/countryFlags';
import { authColors, authSpace, authType } from '~/utils/authTheme';
import type { StepBodyProps } from '../types';

type Country = (typeof COUNTRIES)[number];

export interface NationalityValue {
  code: string;
  name: string;
}

const FEATURED_COUNTRY_CODES = ['GB', 'US', 'NG', 'CA', 'FR', 'DE'] as const;

export function NationalityField({ value, setValue }: StepBodyProps<NationalityValue>) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return COUNTRIES;
    const q = query.toLowerCase();
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  const featuredCountries = useMemo(
    () =>
      FEATURED_COUNTRY_CODES.map((code) => COUNTRIES.find((c) => c.code === code)).filter(
        Boolean
      ) as Country[],
    []
  );

  const selectedCountry = value ? COUNTRIES.find((c) => c.code === value.code) : undefined;
  const visibleCountries =
    selectedCountry && !featuredCountries.some((c) => c.code === selectedCountry.code)
      ? [selectedCountry, ...featuredCountries]
      : featuredCountries;

  const choose = (country: Country) => {
    setValue({ code: country.code, name: country.name });
    setModalOpen(false);
    setQuery('');
  };

  return (
    <>
      <View style={styles.featuredList}>
        {visibleCountries.map((country) => (
          <CountryCard
            key={country.code}
            item={country}
            selected={value?.code === country.code}
            onPress={() => choose(country)}
          />
        ))}
      </View>

      <Pressable
        onPress={() => setModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Browse all countries"
        style={styles.browseButton}>
        <Ionicons name="search" size={18} color={authColors.textPrimary} />
        <Text style={styles.browseText}>Browse all countries</Text>
      </Pressable>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalOpen}
        onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select your country</Text>
            <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={authColors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries..."
              placeholderTextColor={authColors.placeholder}
              autoFocus
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={({ item }: { item: Country }) => (
              <CountryRow
                item={item}
                selected={value?.code === item.code}
                onPress={() => choose(item)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function CountryCard({
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
      accessibilityRole="radio"
      accessibilityLabel={item.name}
      accessibilityState={{ selected }}
      style={[styles.countryCard, selected ? styles.countryCardSelected : null]}>
      <View style={styles.flagCircle}>
        <Text style={styles.flag}>{item.flag}</Text>
      </View>
      <Text style={styles.countryName}>{item.name}</Text>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={authColors.textPrimary} />
      ) : null}
    </Pressable>
  );
}

const CountryRow = CountryCard;

const styles = StyleSheet.create({
  featuredList: {
    gap: authSpace.md,
  },
  countryCard: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    backgroundColor: authColors.surface,
    paddingHorizontal: authSpace.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCardSelected: {
    borderColor: authColors.accent,
  },
  flagCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: authSpace.md,
    backgroundColor: authColors.surface,
  },
  flag: {
    fontSize: 30,
  },
  countryName: {
    flex: 1,
    color: authColors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  browseButton: {
    marginTop: authSpace.lg,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    backgroundColor: authColors.surface,
    paddingHorizontal: authSpace.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: authSpace.sm,
  },
  browseText: {
    color: authColors.textPrimary,
    fontSize: authType.label.fontSize,
    fontWeight: '700',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: authSpace.xl,
    paddingVertical: authSpace.lg,
    borderBottomWidth: 1,
    borderBottomColor: authColors.borderSubtle,
  },
  modalTitle: {
    color: authColors.textPrimary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  doneText: {
    fontSize: 16,
    color: authColors.textPrimary,
    fontWeight: '700',
  },
  searchBox: {
    marginHorizontal: authSpace.xl,
    marginVertical: authSpace.lg,
    backgroundColor: authColors.accentSoft,
    borderRadius: 16,
    paddingHorizontal: authSpace.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: authSpace.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: authColors.textPrimary,
  },
});
