// app/search.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from 'react-native-date-picker';
import { supabase } from '~/utils/supabase';
import { getCountryFlag } from '~/utils/countryFlags';
import { getSuggestions } from '~/utils/AddressAutocomplete';
import { useAuth } from './contexts/AuthProvider';

interface CityResult {
  city: string;
  country: string;
  country_code: string;
  activity_count: number;
  source: 'db' | 'mapbox';
}

/** YYYY-MM-DD in local time, suitable for postgres DATE columns. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatChip(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SearchScreen() {
  const { session } = useAuth();
  const [query, setQuery] = useState('');
  const [dbResults, setDbResults] = useState<CityResult[]>([]);
  const [mapboxResults, setMapboxResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const requestId = useRef(0);
  // Stable Mapbox session token for billing — one session per screen lifetime.
  const mapboxSessionRef = useRef(`search-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const myId = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setMapboxResults([]);
      try {
        const { data, error } = await supabase.rpc('search_cities', {
          query: query.trim(),
          max_results: 12,
        });
        if (myId !== requestId.current) return;
        if (error) throw error;
        const db = ((data ?? []) as unknown as Omit<CityResult, 'source'>[]).map(
          (r) => ({ ...r, source: 'db' as const }),
        );
        setDbResults(db);

        // Fallback to Mapbox autocomplete only when the local DB has no
        // hits AND the query has something meaningful in it. One extra API
        // call per empty search; not per keystroke.
        if (db.length === 0 && query.trim().length >= 2) {
          try {
            const mb = await getSuggestions(
              query.trim(),
              session?.access_token ?? mapboxSessionRef.current,
              { types: ['place', 'locality'], language: 'en' },
            );
            if (myId !== requestId.current) return;
            const seen = new Set<string>();
            const mapped: CityResult[] = (mb?.suggestions ?? [])
              .filter(
                (s: any) =>
                  s?.feature_type === 'place' || s?.feature_type === 'locality',
              )
              .map((s: any) => ({
                city: (s?.name ?? '') as string,
                country: (s?.context?.country?.name ?? '') as string,
                country_code: ((s?.context?.country?.country_code ?? '') as string)
                  .toUpperCase(),
                activity_count: 0,
                source: 'mapbox' as const,
              }))
              .filter((c: CityResult) => {
                const key = `${c.city}|${c.country_code}`;
                if (!c.city || seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            setMapboxResults(mapped);
          } catch (err) {
            console.error('Mapbox fallback failed:', err);
          }
        }
      } catch (err) {
        console.error('search_cities error:', err);
        if (myId === requestId.current) {
          setDbResults([]);
          setMapboxResults([]);
        }
      } finally {
        if (myId === requestId.current) setLoading(false);
      }
    }, query.trim() ? 200 : 0);
    return () => clearTimeout(timer);
  }, [query, session?.access_token]);

  const openCity = useCallback(
    (city: string) => {
      const qs = new URLSearchParams();
      if (fromDate) qs.append('from', toIsoDate(fromDate));
      if (toDate) qs.append('to', toIsoDate(toDate));
      const path = `/city/${encodeURIComponent(city)}${
        qs.toString() ? `?${qs.toString()}` : ''
      }`;
      router.replace(path as never);
    },
    [fromDate, toDate],
  );

  const clearFrom = () => setFromDate(null);
  const clearTo = () => setToDate(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search a city"
          placeholderTextColor="#999"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.dateRow}>
        <Pressable
          style={[styles.dateChip, fromDate && styles.dateChipActive]}
          onPress={() => setFromPickerOpen(true)}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={fromDate ? '#007AFF' : '#666'}
          />
          <Text style={[styles.dateChipText, fromDate && styles.dateChipTextActive]}>
            {fromDate ? formatChip(fromDate) : 'Start'}
          </Text>
          {fromDate ? (
            <Pressable onPress={clearFrom} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color="#666" />
            </Pressable>
          ) : null}
        </Pressable>

        <Ionicons name="arrow-forward" size={16} color="#999" />

        <Pressable
          style={[styles.dateChip, toDate && styles.dateChipActive]}
          onPress={() => setToPickerOpen(true)}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={toDate ? '#007AFF' : '#666'}
          />
          <Text style={[styles.dateChipText, toDate && styles.dateChipTextActive]}>
            {toDate ? formatChip(toDate) : 'End'}
          </Text>
          {toDate ? (
            <Pressable onPress={clearTo} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color="#666" />
            </Pressable>
          ) : null}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#007AFF" />
        </View>
      ) : (
        <SectionList
          sections={[
            ...(dbResults.length > 0
              ? [
                  {
                    title: query.trim() ? 'Results' : 'Popular cities',
                    data: dbResults,
                  },
                ]
              : []),
            ...(mapboxResults.length > 0
              ? [{ title: 'Discover cities', data: mapboxResults }]
              : []),
          ]}
          keyExtractor={(item) => `${item.source}-${item.country_code}-${item.city}`}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionLabel}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => openCity(item.city)}>
              <Text style={styles.resultFlag}>
                {item.country_code ? getCountryFlag(item.country_code) : '🌍'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultCity}>{item.city}</Text>
                <Text style={styles.resultCountry}>
                  {item.source === 'mapbox'
                    ? `${item.country} · No activity yet`
                    : item.country ?? ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C0C0C0" />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {query.trim() ? 'No cities match' : 'No active cities yet'}
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}

      <DatePicker
        modal
        open={fromPickerOpen}
        date={fromDate ?? new Date()}
        mode="date"
        onConfirm={(d) => {
          setFromPickerOpen(false);
          setFromDate(d);
          if (toDate && d > toDate) setToDate(null);
        }}
        onCancel={() => setFromPickerOpen(false)}
      />
      <DatePicker
        modal
        open={toPickerOpen}
        date={toDate ?? fromDate ?? new Date()}
        mode="date"
        minimumDate={fromDate ?? undefined}
        onConfirm={(d) => {
          setToPickerOpen(false);
          setToDate(d);
        }}
        onCancel={() => setToPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    minWidth: 100,
  },
  dateChipActive: {
    backgroundColor: '#E8F2FF',
  },
  dateChipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dateChipTextActive: {
    color: '#007AFF',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  resultFlag: {
    fontSize: 28,
  },
  resultCity: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  resultCountry: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
});
