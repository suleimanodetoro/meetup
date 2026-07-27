// app/create-plan/intent.tsx
// The intent on-ramp to creating a sidequest: an airy "tell us the mood" screen.
// Intent is composed as a tappable sentence (vibe / energy / length / who /
// budget tokens) — tapping a token opens that group's options in a tray above
// the composer. Mood presets fill several slots in one tap. Suggest runs the
// suggest_quest RPC and results slide up in a bottom sheet; tap one to pre-fill
// the create form, or skip straight to a blank custom sidequest.
// Optional and skippable — never forced.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import { useCreatePlan } from '~/contexts/CreatePlanContext';
import { displayFont } from '~/utils/fonts';

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

interface IntentParams {
  energy: number | null;
  time: number | null;
  who: string | null;
  spend: number | null;
  vibes: string[];
}

const EMPTY_INTENT: IntentParams = { energy: null, time: null, who: null, spend: null, vibes: [] };

// Sentence-friendly labels: these read inline as "Something chill · low-key ·
// about an hour · just me · free".
const ENERGY = [
  { l: 'low-key', v: 1 },
  { l: 'medium energy', v: 2 },
  { l: 'high energy', v: 3 },
];
const TIME = [
  { l: 'quick (≤30 min)', v: 30 },
  { l: 'about an hour', v: 60 },
  { l: 'a few hours', v: 180 },
  { l: 'all day', v: 600 },
];
const WHO = [
  { l: 'just me', v: 'solo' },
  { l: 'me + one', v: 'pair' },
  { l: 'a group', v: 'group' },
];
const SPEND = [
  { l: 'free', v: 0 },
  { l: 'cheap', v: 1 },
  { l: 'a treat', v: 2 },
];
const VIBES = [
  { l: 'chill', v: 'cozy' },
  { l: 'adventurous', v: 'adventurous' },
  { l: 'creative', v: 'creative' },
  { l: 'social', v: 'social' },
  { l: 'outdoors', v: 'outdoors' },
  { l: 'wholesome', v: 'kind' },
  { l: 'brave', v: 'brave' },
  { l: 'spontaneous', v: 'spontaneous' },
];

type SlotKey = 'vibes' | 'energy' | 'time' | 'who' | 'spend';
const SLOT_ORDER: SlotKey[] = ['vibes', 'energy', 'time', 'who', 'spend'];
const SLOT_PLACEHOLDER: Record<SlotKey, string> = {
  vibes: 'any vibe',
  energy: 'any energy',
  time: 'any length',
  who: 'anyone',
  spend: 'any budget',
};
const SLOT_OPTIONS: Record<SlotKey, { l: string; v: string | number }[]> = {
  vibes: VIBES,
  energy: ENERGY,
  time: TIME,
  who: WHO,
  spend: SPEND,
};

// One-tap moods (the Tiimo-style suggestion chips): each fills several slots
// at once. Partial on purpose — untouched slots stay "any".
const PRESETS: { key: string; emoji: string; label: string; fill: Partial<IntentParams> }[] = [
  { key: 'chill', emoji: '🌿', label: 'Chill evening', fill: { energy: 1, time: 60, vibes: ['cozy'] } },
  { key: 'group', emoji: '⚡', label: 'Big group energy', fill: { energy: 3, who: 'group', vibes: ['social'] } },
  { key: 'creative', emoji: '🎨', label: 'Creative hour', fill: { energy: 2, time: 60, vibes: ['creative'] } },
  { key: 'outdoors', emoji: '🥾', label: 'Outdoors adventure', fill: { energy: 3, time: 180, vibes: ['outdoors', 'adventurous'] } },
  { key: 'free', emoji: '💸', label: 'Free & spontaneous', fill: { spend: 0, vibes: ['spontaneous'] } },
  { key: 'kind', emoji: '🫶', label: 'Something wholesome', fill: { energy: 1, vibes: ['kind'] } },
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
  const { session } = useAuth();
  const { updateField, resetForm } = useCreatePlan();
  const [intent, setIntent] = useState<IntentParams>(EMPTY_INTENT);
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [errored, setErrored] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['60%', '90%'], []);

  // Fresh form each time we enter the create on-ramp.
  const didReset = useRef(false);
  useEffect(() => {
    if (!didReset.current) {
      didReset.current = true;
      resetForm();
    }
  }, [resetForm]);

  // Persist one coherent behavioural fact per suggestion request. The RPC
  // commits quest_intents + intent.submitted atomically; the suggestion UI
  // remains available if capture fails, but analytics can no longer claim an
  // intent that the product did not persist.
  const persistIntent = async (p: IntentParams) => {
    const uid = session?.user?.id;
    if (!uid) return;
    try {
      const { error } = await supabase.rpc('capture_quest_intent', {
        p_energy: p.energy,
        p_social: p.who,
        p_time_max: p.time,
        p_budget: p.spend,
        p_categories: p.vibes.length ? p.vibes : null,
      });
      if (error) throw error;
    } catch (error) {
      console.warn('intent capture failed (non-blocking):', error);
    }
  };

  // Takes explicit params (not state) so "Surprise me" and preset flows can't
  // race a pending setState.
  const runSuggest = async (p: IntentParams) => {
    setActiveSlot(null);
    setLoading(true);
    setErrored(false);
    void persistIntent(p);
    try {
      const { data, error } = await (supabase.rpc as any)('suggest_quest', {
        p_energy: p.energy,
        p_social: p.who,
        p_time_max: p.time,
        p_budget: p.spend,
        p_categories: p.vibes.length ? p.vibes : null,
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
      sheetRef.current?.snapToIndex(0);
    }
  };

  const suggest = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void runSuggest(intent);
  };

  const surpriseMe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIntent(EMPTY_INTENT);
    void runSuggest(EMPTY_INTENT);
  };

  const applyPreset = (fill: Partial<IntentParams>) => {
    void Haptics.selectionAsync();
    setActiveSlot(null);
    setIntent((prev) => ({ ...prev, ...fill }));
  };

  const tapSlot = (slot: SlotKey) => {
    void Haptics.selectionAsync();
    setActiveSlot((prev) => (prev === slot ? null : slot));
  };

  // Single-select slots auto-advance to the next empty slot; the multi-select
  // vibe slot stays open so people can stack a couple.
  const pickOption = (slot: SlotKey, v: string | number) => {
    void Haptics.selectionAsync();
    if (slot === 'vibes') {
      setIntent((prev) => ({
        ...prev,
        vibes: prev.vibes.includes(v as string)
          ? prev.vibes.filter((x) => x !== v)
          : [...prev.vibes, v as string],
      }));
      return;
    }
    const cleared = intent[slot] === v;
    const next: IntentParams = { ...intent, [slot]: cleared ? null : v };
    setIntent(next);
    if (!cleared) {
      const after = SLOT_ORDER.slice(SLOT_ORDER.indexOf(slot) + 1);
      const nextEmpty = after.find((s) => (s === 'vibes' ? next.vibes.length === 0 : next[s] == null));
      setActiveSlot(nextEmpty ?? null);
    }
  };

  const clearSlot = (slot: SlotKey) => {
    void Haptics.selectionAsync();
    setIntent((prev) => (slot === 'vibes' ? { ...prev, vibes: [] } : { ...prev, [slot]: null }));
  };

  const slotLabel = (slot: SlotKey): string | null => {
    if (slot === 'vibes') {
      if (!intent.vibes.length) return null;
      const labels = intent.vibes.map((v) => VIBES.find((o) => o.v === v)?.l ?? v);
      return labels.length > 2 ? `${labels.slice(0, 2).join(' + ')} +${labels.length - 2}` : labels.join(' + ');
    }
    const val = intent[slot];
    if (val == null) return null;
    return SLOT_OPTIONS[slot].find((o) => o.v === val)?.l ?? String(val);
  };

  const pick = (s: Suggestion) => {
    sheetRef.current?.close();
    updateField('title', s.title);
    updateField('description', s.dare);
    router.push('/create-plan/name');
  };

  const startBlank = () => {
    sheetRef.current?.close();
    router.push('/create-plan/name');
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating header — round back button left, skip pill right. */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.roundButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#333" />
        </Pressable>
        <Pressable onPress={startBlank} style={styles.skipPill} hitSlop={8}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Hero — breathing orb + display headline, centered in the free space. */}
      <Pressable style={styles.hero} onPress={() => setActiveSlot(null)}>
        <Orb />
        <Text style={styles.heroTitle}>What are you{'\n'}in the mood for?</Text>
        <Text style={styles.heroSub}>Tap a mood, or build your own below</Text>
      </Pressable>

      {/* Tray zone — mood presets by default; the active slot's options when a
          token is open. */}
      <View style={styles.trayZone}>
        {activeSlot ? (
          <Animated.View key={activeSlot} entering={FadeInDown.duration(180)} exiting={FadeOutDown.duration(120)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled">
              {SLOT_OPTIONS[activeSlot].map((o) => {
                const on =
                  activeSlot === 'vibes'
                    ? intent.vibes.includes(o.v as string)
                    : intent[activeSlot] === o.v;
                return (
                  <Pressable
                    key={String(o.v)}
                    onPress={() => pickOption(activeSlot, o.v)}
                    style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.l}</Text>
                  </Pressable>
                );
              })}
              {slotLabel(activeSlot) ? (
                <Pressable onPress={() => clearSlot(activeSlot)} style={[styles.chip, styles.chipClear]}>
                  <Text style={styles.chipClearText}>clear</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(180)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              {PRESETS.slice(0, 3).map((p) => (
                <PresetChip key={p.key} preset={p} onPress={() => applyPreset(p.fill)} />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chipRow, styles.chipRowStagger]}>
              {PRESETS.slice(3).map((p) => (
                <PresetChip key={p.key} preset={p} onPress={() => applyPreset(p.fill)} />
              ))}
              <Pressable onPress={surpriseMe} style={styles.presetChip}>
                <Text style={styles.presetEmoji}>🎲</Text>
                <Text style={styles.presetText}>Surprise me</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        )}
      </View>

      {/* Composer — the "input": intent as a tappable sentence + round suggest. */}
      <View style={styles.composer}>
        <View style={styles.sentence}>
          <Text style={styles.sentenceWord}>Something</Text>
          {SLOT_ORDER.map((slot) => {
            const label = slotLabel(slot);
            const active = activeSlot === slot;
            return (
              <Pressable
                key={slot}
                onPress={() => tapSlot(slot)}
                style={[styles.token, label ? styles.tokenFilled : styles.tokenEmpty, active && styles.tokenActive]}>
                <Text style={[styles.tokenText, label ? styles.tokenTextFilled : styles.tokenTextEmpty]}>
                  {label ?? SLOT_PLACEHOLDER[slot]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.composerFooter}>
          <Pressable onPress={startBlank} hitSlop={8}>
            <Text style={styles.scratchText}>Start from scratch</Text>
          </Pressable>
          <SuggestButton onPress={suggest} loading={loading} />
        </View>
      </View>

      {/* Results sheet. */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBg}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Sidequests for you</Text>
          <Pressable onPress={suggest} style={styles.shuffleButton} hitSlop={8} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="shuffle" size={20} color="#007AFF" />
            )}
          </Pressable>
        </View>
        <BottomSheetFlatList
          data={results ?? []}
          keyExtractor={(s: Suggestion) => String(s.id)}
          contentContainerStyle={styles.sheetContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {errored
                ? "Couldn't load suggestions right now. You can still start from scratch."
                : 'No matches for that mood — try loosening a token, or start from scratch.'}
            </Text>
          }
          ListFooterComponent={
            <Pressable onPress={startBlank} style={styles.scratchButton}>
              <Text style={styles.scratchText}>Start from scratch instead</Text>
            </Pressable>
          }
          renderItem={({ item: s }: { item: Suggestion }) => (
            <Pressable onPress={() => pick(s)} style={styles.card}>
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
          )}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

/** The listening orb: layered glow + eyes + smile, with a slow breathe. */
function Orb() {
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [breathe]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.05 }],
  }));
  return (
    <Animated.View style={[styles.orbWrap, style]}>
      <LinearGradient
        colors={['rgba(61,155,255,0.55)', 'rgba(10,92,224,0.12)']}
        start={{ x: 0.5, y: 0.15 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.orbGlow}
      />
      <LinearGradient
        colors={['#6FB6FF', '#2F7FE8']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={styles.orbBody}>
        <View style={styles.orbEyes}>
          <View style={styles.orbEye} />
          <View style={styles.orbEye} />
        </View>
        <View style={styles.orbSmile} />
      </LinearGradient>
    </Animated.View>
  );
}

function PresetChip({
  preset,
  onPress,
}: {
  preset: { emoji: string; label: string };
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.presetChip}>
      <Text style={styles.presetEmoji}>{preset.emoji}</Text>
      <Text style={styles.presetText}>{preset.label}</Text>
    </Pressable>
  );
}

/** Round refraction CTA — same gradient + sheen + colored shadow recipe as
 *  GradientButton, in the compact circular "send" form. */
function SuggestButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Suggest sidequests"
      style={styles.suggestShadow}>
      <LinearGradient
        colors={['#3D9BFF', '#0A5CE0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.suggestCircle}>
        <LinearGradient
          colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.suggestSheen}
          pointerEvents="none"
        />
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="sparkles" size={22} color="#fff" />
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  skipPill: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  skipText: { fontSize: 15, color: '#333', fontWeight: '600' },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  heroTitle: {
    ...displayFont('700'),
    fontSize: 30,
    lineHeight: 38,
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 24,
  },
  heroSub: { fontSize: 15, color: '#8A8A85', marginTop: 10, textAlign: 'center' },

  orbWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  orbGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, opacity: 0.9 },
  orbBody: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A5CE0',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  orbEyes: { flexDirection: 'row', gap: 14, marginTop: 4 },
  orbEye: { width: 12, height: 16, borderRadius: 6, backgroundColor: '#0B2B57' },
  orbSmile: {
    width: 18,
    height: 9,
    marginTop: 6,
    borderBottomWidth: 2.5,
    borderColor: '#0B2B57',
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
  },

  trayZone: { minHeight: 112, justifyContent: 'flex-end', marginBottom: 12 },
  chipRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chipRowStagger: { paddingLeft: 34, marginTop: 8 },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 22,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  presetEmoji: { fontSize: 15 },
  presetText: { fontSize: 15, color: '#333', fontWeight: '500' },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E6E1',
  },
  chipOn: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 15, color: '#333', fontWeight: '500' },
  chipTextOn: { color: '#fff' },
  chipClear: { borderStyle: 'dashed' },
  chipClearText: { fontSize: 15, color: '#8A8A85', fontWeight: '500' },

  composer: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sentenceWord: { fontSize: 17, color: '#555', fontWeight: '500' },
  token: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  tokenEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D6D3CC',
  },
  tokenFilled: { backgroundColor: '#EAF3FF' },
  tokenActive: {
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderColor: '#007AFF',
  },
  tokenText: { fontSize: 15, fontWeight: '600' },
  tokenTextEmpty: { color: '#9C9992' },
  tokenTextFilled: { color: '#0A5CE0' },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  suggestShadow: {
    borderRadius: 27,
    shadowColor: '#0A5CE0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  suggestCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  suggestSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },

  sheetBg: { backgroundColor: '#fff', borderRadius: 28 },
  sheetHandle: { backgroundColor: '#D6D3CC', width: 44 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sheetTitle: { ...displayFont('600'), fontSize: 20, color: '#1A1A1A' },
  shuffleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
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
  scratchButton: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  scratchText: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
});
