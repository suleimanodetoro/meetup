import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { useAuth } from '~/contexts/AuthProvider';
import { supabase } from '~/utils/supabase';
import { getSuggestions } from '~/utils/AddressAutocomplete';
import { authColors } from '~/utils/authTheme';
import { OnboardingFrame } from '../OnboardingFrame';
import type { CustomStepProps } from '../types';

interface Destination {
  city: string;
  country: string;
  country_code: string;
  flag: string;
}

interface Suggestion {
  city: string;
  country: string;
  country_code: string;
  flag: string;
  full_address?: string;
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Custom-takeover body for the trips step. Writes to `visits`, not
 * `profiles`. Owns its own Continue/Skip buttons (instead of using the
 * shared Frame's) because it needs to gate Continue on a 3-field local
 * form and run its own insert before advancing.
 */
export function TripsCustom({ step, advance, goBack }: CustomStepProps) {
  const { session } = useAuth();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const canContinue = !!destination && !!startDate && !!endDate;

  const onContinue = async () => {
    if (!canContinue || saving) return;
    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Not signed in');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('visits').insert({
        user_id: userId,
        city: destination.city,
        country: destination.country,
        country_code: destination.country_code,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });
      if (error) throw error;
      await advance({});
    } catch (err) {
      console.error('Error saving trip:', err);
      Alert.alert('Error', 'Failed to save trip. Please try again.');
      setSaving(false);
    }
  };

  const onSkip = async () => {
    if (saving) return;
    await advance({});
  };

  return (
    <OnboardingFrame
      title={step.title}
      subtitle={step.subtitle}
      onBack={goBack}
      onSkip={onSkip}
      onContinue={onContinue}
      canContinue={canContinue}
      busy={saving}
      continueLabel={saving ? 'Saving...' : 'Continue'}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 12,
          color: authColors.textPrimary,
        }}>
        Destination
      </Text>
      <Pressable
        onPress={() => setShowDestinationModal(true)}
        style={{
          backgroundColor: authColors.surface,
          padding: 20,
          borderRadius: 16,
          marginBottom: 30,
          borderWidth: 1,
          borderColor: destination ? authColors.accent : authColors.borderSubtle,
        }}>
        <Text
          style={{
            fontSize: 16,
            color: destination ? authColors.textPrimary : authColors.placeholder,
            fontWeight: '600',
          }}>
          {destination
            ? `${destination.flag} ${destination.city}, ${destination.country}`
            : 'Where are you going?'}
        </Text>
      </Pressable>

      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 12,
          color: authColors.textPrimary,
        }}>
        Travel Dates
      </Text>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
        <DateButton label="From" date={startDate} onPress={() => setShowStartPicker(true)} />
        <DateButton label="To" date={endDate} onPress={() => setShowEndPicker(true)} />
      </View>

      <DestinationModal
        visible={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        accessToken={session?.access_token ?? null}
        selected={destination}
        onSelect={(d) => {
          setDestination(d);
          setShowDestinationModal(false);
        }}
      />

      <DatePicker
        modal
        open={showStartPicker}
        date={startDate || new Date()}
        mode="date"
        minimumDate={new Date()}
        onConfirm={(date) => {
          setStartDate(date);
          setShowStartPicker(false);
          if (!endDate) setTimeout(() => setShowEndPicker(true), 300);
        }}
        onCancel={() => setShowStartPicker(false)}
        title="Select start date"
      />
      <DatePicker
        modal
        open={showEndPicker}
        date={
          endDate ||
          (startDate ? new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date())
        }
        mode="date"
        minimumDate={startDate || new Date()}
        onConfirm={(date) => {
          setEndDate(date);
          setShowEndPicker(false);
        }}
        onCancel={() => setShowEndPicker(false)}
        title="Select end date"
      />
    </OnboardingFrame>
  );
}

function DateButton({
  label,
  date,
  onPress,
}: {
  label: string;
  date: Date | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: authColors.surface,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: date ? authColors.accent : authColors.borderSubtle,
      }}>
      <Text style={{ fontSize: 12, color: authColors.textSecondary, marginBottom: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: date ? authColors.textPrimary : authColors.placeholder,
          fontWeight: '600',
        }}>
        {date
          ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : label === 'From'
            ? 'Start date'
            : 'End date'}
      </Text>
    </Pressable>
  );
}

function DestinationModal({
  visible,
  onClose,
  accessToken,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  accessToken: string | null;
  selected: Destination | null;
  onSelect: (d: Destination) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const data = await getSuggestions(query, accessToken || 'session-' + Date.now(), {
          types: ['place', 'locality'],
        });
        const cityResults: Suggestion[] = ((data?.suggestions ?? []) as any[])
          .filter((s) => s.feature_type === 'place' || s.feature_type === 'locality')
          .map((s) => ({
            city: s.name,
            country: s.context?.country?.name || 'Unknown',
            country_code: s.context?.country?.country_code || 'XX',
            flag: getCountryFlag(s.context?.country?.country_code || 'XX'),
            full_address: s.place_formatted,
          }));
        setResults(cityResults);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, accessToken]);

  return (
    <Modal animationType="slide" transparent={false} visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: authColors.bg }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderBottomColor: authColors.borderSubtle,
          }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: authColors.textPrimary }}>
            Select Destination
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ fontSize: 17, color: authColors.accent, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </View>

        <View
          style={{
            marginHorizontal: 20,
            marginVertical: 15,
            backgroundColor: authColors.accentSoft,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Text style={{ fontSize: 16, marginRight: 8, color: authColors.textTertiary }}>
            Search
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search any city..."
            placeholderTextColor={authColors.placeholder}
            autoFocus
            style={{ flex: 1, fontSize: 16, color: authColors.textPrimary }}
          />
          {searching ? <ActivityIndicator size="small" color={authColors.accent} /> : null}
        </View>

        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.city}-${item.country_code}-${index}`}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderBottomWidth: 1,
                borderBottomColor: authColors.borderMuted,
                backgroundColor:
                  selected?.city === item.city && selected?.country_code === item.country_code
                    ? authColors.accentSoft
                    : authColors.surface,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: authColors.textPrimary }}>
                  {item.city}
                </Text>
                <Text style={{ fontSize: 14, color: authColors.textSecondary, marginTop: 2 }}>
                  {item.country}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              {query.trim().length === 0 ? (
                <Text
                  style={{
                    fontSize: 16,
                    color: authColors.textTertiary,
                    textAlign: 'center',
                    paddingHorizontal: 40,
                  }}>
                  Start typing to search for any city in the world
                </Text>
              ) : searching ? (
                <ActivityIndicator size="large" color={authColors.accent} />
              ) : (
                <Text style={{ fontSize: 16, color: authColors.textTertiary }}>
                  No cities found
                </Text>
              )}
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
