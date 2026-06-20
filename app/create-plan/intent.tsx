// app/create-plan/intent.tsx
// The intent on-ramp to creating a sidequest: pick a few loose factors → we
// suggest matching sidequests from the catalog (suggest_quest RPC) → tap one to
// pre-fill the create form, or skip straight to a blank custom sidequest.
// Optional and skippable — never forced.
import React, { useRef, useState } from 'react';
import { View, Text, Pressable, SafeAreaView, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useCreatePlan } from '~/contexts/CreatePlanContext';
import { GradientButton } from '~/components/GradientButton';

interface Suggestion {
  id: number;
  title: string;
  dare: string;
  category: string;
  energy_level: number;
  social_mode: string;
  duration_min: number;
  cost_tier: number;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  vibe: string[];
  match_reasons: string[];
}

const ENERGY = [
  { l: 'Low', v: 1 },
  { l: 'Medium', v: 2 },
  { l: 'High', v: 3 },
];
const TIME = [
  { l: '≤30 min', v: 30 },
  { l: '~1 hour', v: 60 },
  { l: 'A few hours', v: 180 },
  { l: 'All day', v: 600 },
];
const WHO = [
  { l: 'Solo', v: 'solo' },
  { l: 'A pair', v: 'pair' },
  { l: 'A group', v: 'group' },
];
const SPEND = [
  { l: 'Free', v: 0 },
  { l: 'Cheap', v: 1 },
  { l: 'Treat', v: 2 },
];
const VIBES = [
  { l: 'Chill', v: 'cozy' },
  { l: 'Adventurous', v: 'adventurous' },
  { l: 'Creative', v: 'creative' },
  { l: 'Social', v: 'social' },
  { l: 'Outdoors', v: 'outdoors' },
  { l: 'Wholesome', v: 'kind' },
  { l: 'Brave', v: 'brave' },
  { l: 'Spontaneous', v: 'spontaneous' },
];

function costLabel(s: Suggestion): string {
  if (s.cost_tier === 0 || (s.budget_max ?? 0) === 0) return 'Free';
  const sym = s.currency === 'GBP' ? '£' : s.currency ? `${s.currency} ` : '';
  if (s.budget_min != null && s.budget_max != null) return `${sym}${s.budget_min}–${s.budget_max}`;
  return s.cost_tier === 1 ? 'Cheap' : 'Treat';
}

function durLabel(min: number): string {
  if (min <= 30) return '≤30 min';
  if (min <= 60) return '~1 hr';
  if (min < 240) return `~${Math.round(min / 60)} hrs`;
  return 'All day';
}

export default function CreateIntentScreen() {
  const { updateField, resetForm } = useCreatePlan();
  const [energy, setEnergy] = useState<number | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [spend, setSpend] = useState<number | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [errored, setErrored] = useState(false);

  // Fresh form each time we enter the create on-ramp.
  const didReset = useRef(false);
  React.useEffect(() => {
    if (!didReset.current) {
      didReset.current = true;
      resetForm();
    }
  }, [resetForm]);

  const toggleVibe = (v: string) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const suggest = async () => {
    setLoading(true);
    setErrored(false);
    try {
      const { data, error } = await (supabase.rpc as any)('suggest_quest', {
        p_energy: energy,
        p_social: who,
        p_time_max: time,
        p_budget: spend,
        p_categories: vibes.length ? vibes : null,
        p_limit: 12,
      });
      if (error) throw error;
      setResults((data ?? []) as Suggestion[]);
    } catch (e) {
      console.warn('suggest_quest failed:', e);
      setErrored(true);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const pick = (s: Suggestion) => {
    updateField('title', s.title);
    updateField('description', s.dare);
    router.push('/create-plan/name');
  };

  const startBlank = () => router.push('/create-plan/name');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>Start a sidequest</Text>
        <Pressable onPress={startBlank} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>What are you in the mood for?</Text>
        <Text style={styles.subtitle}>
          Pick a few and we&apos;ll suggest sidequests — or skip and start from scratch.
        </Text>

        <ChipGroup label="Energy" options={ENERGY} selected={energy} onSelect={setEnergy} />
        <ChipGroup label="Time" options={TIME} selected={time} onSelect={setTime} />
        <ChipGroup label="Who" options={WHO} selected={who} onSelect={setWho} />
        <ChipGroup label="Spend" options={SPEND} selected={spend} onSelect={setSpend} />

        <Text style={styles.groupLabel}>Vibe</Text>
        <View style={styles.chipWrap}>
          {VIBES.map((o) => {
            const on = vibes.includes(o.v);
            return (
              <Pressable
                key={o.v}
                onPress={() => toggleVibe(o.v)}
                style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.l}</Text>
              </Pressable>
            );
          })}
        </View>

        <GradientButton
          label={results ? 'Suggest again' : 'Suggest sidequests'}
          onPress={suggest}
          loading={loading}
          style={{ marginTop: 28 }}
        />

        {results !== null && !loading && (
          <View style={styles.results}>
            {errored ? (
              <Text style={styles.emptyText}>
                Couldn&apos;t load suggestions right now. You can still start from scratch below.
              </Text>
            ) : results.length === 0 ? (
              <Text style={styles.emptyText}>
                No matches for those filters — try fewer, or start from scratch.
              </Text>
            ) : (
              results.map((s) => (
                <Pressable key={s.id} onPress={() => pick(s)} style={styles.card}>
                  <Text style={styles.cardTitle}>{s.title}</Text>
                  <Text style={styles.cardDare} numberOfLines={2}>
                    {s.dare}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardMeta}>{durLabel(s.duration_min)}</Text>
                    <Text style={styles.cardMetaDot}>·</Text>
                    <Text style={styles.cardMeta}>{costLabel(s)}</Text>
                    {s.match_reasons?.[0] ? (
                      <>
                        <Text style={styles.cardMetaDot}>·</Text>
                        <Text style={styles.cardReason}>{s.match_reasons[0]}</Text>
                      </>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        <Pressable onPress={startBlank} style={styles.scratchButton}>
          <Text style={styles.scratchText}>Start from scratch instead</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChipGroup<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { l: string; v: T }[];
  selected: T | null;
  onSelect: (v: T | null) => void;
}) {
  return (
    <>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((o) => {
          const on = selected === o.v;
          return (
            <Pressable
              key={String(o.v)}
              onPress={() => onSelect(on ? null : o.v)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.l}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  skipButton: { padding: 4, minWidth: 32, alignItems: 'flex-end' },
  skipText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 24, lineHeight: 21 },
  groupLabel: { fontSize: 15, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#F2F4F7',
    borderWidth: 1,
    borderColor: '#E5E8EC',
  },
  chipOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 15, color: '#333', fontWeight: '500' },
  chipTextOn: { color: '#fff' },
  suggestButton: {
    marginTop: 28,
    backgroundColor: '#007AFF',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  suggestText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  results: { marginTop: 20, gap: 12 },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 12,
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEFF2',
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 4 },
  cardDare: { fontSize: 14, color: '#555', lineHeight: 20 },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
    flexWrap: 'wrap',
  },
  cardMeta: { fontSize: 13, color: '#777', fontWeight: '600' },
  cardMetaDot: { fontSize: 13, color: '#bbb' },
  cardReason: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
  scratchButton: { marginTop: 24, alignItems: 'center', paddingVertical: 10 },
  scratchText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
});
