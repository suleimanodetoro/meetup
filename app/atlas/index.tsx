// Atlas planner (dev surface, shadow mode).
//
// Free-text intention in, fully-verified plan proposal out — rendered with
// the whole decision visible: compiled constraints, the chosen quest with
// retrieval similarity, the composed group with cooperative roles, and every
// deterministic verifier check. Nothing is created: shadow mode records the
// decision in the service-side ledger and stops.
//
// Entry point: Settings → Dev — Atlas (\_\_DEV\_\_ only). The screen itself is
// also registered in NavigationController's staticRoutes.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GradientButton } from '~/components/GradientButton';
import { supabase } from '~/utils/supabase';
import { displayFont } from '~/utils/fonts';

const PLACEHOLDER =
  "I'm new to Leeds, free 7–10 tonight, have £15, don't drink, feel awkward meeting strangers, and like photography.";

interface CompiledView {
  city: string | null;
  window: { dateHint: string | null; startLocal: string | null; endLocal: string | null };
  durationMaxMin: number | null;
  budgetGbp: number | null;
  budgetTier: number | null;
  energy: number | null;
  social: string | null;
  comfort: number | null;
  avoidTags: string[];
  interestTags: string[];
  notes: string[];
  confidence: number;
}

interface VerifierRow {
  id: string;
  description: string;
  severity: 'block' | 'warn';
  pass: boolean;
  detail: string;
}

interface AtlasResponse {
  request_id: string;
  decision_id: number;
  status: 'proposed' | 'rejected' | 'error';
  stage: string;
  compiled: CompiledView | null;
  plan: {
    quest: {
      title: string;
      dare: string;
      why: string | null;
      category: string;
      duration_min: number;
      budget_min: number | null;
      budget_max: number | null;
      currency: string | null;
      risk_tier: number;
      vibe: string[];
      similarity: number | null;
      source: string;
    };
    schedule: { starts_at_utc: string; local_label: string };
    city: string;
    group: {
      size: number;
      average_chemistry: number;
      min_pair_chemistry: number;
      members: { user_id: string; full_name: string | null; role: string }[];
    };
  } | null;
  verifier: VerifierRow[];
  rejection_reasons: string[];
  meta: {
    engine_version: string;
    compiler_kind: string;
    model_id: string | null;
    embedding_version: string | null;
    latency_ms: number;
  };
}

export default function AtlasScreen() {
  const [intentText, setIntentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AtlasResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // The Settings entry is __DEV__-gated, but the route itself is registered
  // unconditionally in NavigationController — gate the screen too so a prod
  // deep link to /atlas cannot reach the dev surface.
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />;
  }

  const runAtlas = async () => {
    const text = intentText.trim();
    if (text.length < 3 || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrorText(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('atlas-plan', {
        body: { intent_text: text },
      });
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx) detail = ((await ctx.json()) as { error?: string }).error ?? detail;
        } catch {
          // keep the generic message
        }
        setErrorText(detail);
        return;
      }
      setResult(data as AtlasResponse);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : 'Atlas request failed');
    } finally {
      setLoading(false);
    }
  };

  const compiledChips = (c: CompiledView): string[] => {
    const chips: string[] = [];
    if (c.city) chips.push(`📍 ${c.city}`);
    if (c.window.startLocal) {
      chips.push(`🕖 ${c.window.startLocal}–${c.window.endLocal ?? '…'}${c.window.dateHint ? ` ${c.window.dateHint}` : ''}`);
    } else if (c.window.dateHint) {
      chips.push(`🗓 ${c.window.dateHint}`);
    }
    if (c.durationMaxMin) chips.push(`⏱ ≤${c.durationMaxMin} min`);
    if (c.budgetGbp !== null) chips.push(`💷 ~£${c.budgetGbp}`);
    if (c.energy) chips.push(`⚡ energy ${c.energy}/3`);
    if (c.comfort) chips.push(`🫶 comfort ${c.comfort}/3`);
    if (c.social) chips.push(`👥 ${c.social}`);
    for (const tag of c.interestTags) chips.push(`♥ ${tag}`);
    for (const tag of c.avoidTags.slice(0, 3)) chips.push(`🚫 ${tag}`);
    return chips;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={[styles.title, displayFont('700')]}>Atlas</Text>
        <View style={styles.shadowBadge}>
          <Text style={styles.shadowBadgeText}>SHADOW</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.lede}>
          Say what you actually want tonight — time, money, mood, limits. Atlas compiles it, finds a
          quest, composes a group, and verifies every constraint. Nothing is created in shadow mode.
        </Text>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={intentText}
            onChangeText={setIntentText}
            placeholder={PLACEHOLDER}
            placeholderTextColor="#A9A9A4"
            multiline
            maxLength={500}
            editable={!loading}
          />
          <View style={styles.inputFooter}>
            <TouchableOpacity onPress={() => setIntentText(PLACEHOLDER)} disabled={loading}>
              <Text style={styles.tryDemo}>Try the demo sentence</Text>
            </TouchableOpacity>
            <Text style={styles.counter}>{intentText.length}/500</Text>
          </View>
        </View>

        <GradientButton
          label={loading ? 'Planning…' : 'Plan with Atlas'}
          icon="sparkles-outline"
          onPress={runAtlas}
          disabled={intentText.trim().length < 3 || loading}
          loading={loading}
        />

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#007AFF" />
            <Text style={styles.loadingText}>compile → retrieve → compose → verify</Text>
          </View>
        )}

        {errorText && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        )}

        {result && (
          <>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusPill,
                  result.status === 'proposed' ? styles.statusProposed : styles.statusRejected,
                ]}
              >
                <Text style={styles.statusPillText}>
                  {result.status === 'proposed' ? 'PLAN VERIFIED' : result.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.latency}>{result.meta.latency_ms} ms</Text>
            </View>

            {result.compiled && (
              <View style={styles.card}>
                <Text style={styles.cardKicker}>WHAT ATLAS HEARD</Text>
                <View style={styles.chipWrap}>
                  {compiledChips(result.compiled).map((chip) => (
                    <View key={chip} style={styles.chip}>
                      <Text style={styles.chipText}>{chip}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.confidence}>
                  compiler confidence {Math.round(result.compiled.confidence * 100)}%
                </Text>
              </View>
            )}

            {result.plan && (
              <View style={styles.card}>
                <Text style={styles.cardKicker}>THE PLAN · {result.plan.city.toUpperCase()}</Text>
                <Text style={[styles.questTitle, displayFont('700')]}>{result.plan.quest.title}</Text>
                <Text style={styles.questDare}>{result.plan.quest.dare}</Text>
                {result.plan.quest.why ? <Text style={styles.questWhy}>{result.plan.quest.why}</Text> : null}
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={15} color="#8A8A85" />
                  <Text style={styles.metaText}>{result.plan.schedule.local_label}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="pricetag-outline" size={15} color="#8A8A85" />
                  <Text style={styles.metaText}>
                    {result.plan.quest.budget_max !== null
                      ? `up to £${result.plan.quest.budget_max}`
                      : 'free'}
                    {' · '}
                    {result.plan.quest.duration_min} min
                    {result.plan.quest.similarity !== null
                      ? ` · match ${(result.plan.quest.similarity * 100).toFixed(0)}%`
                      : ' · deterministic fallback'}
                  </Text>
                </View>

                <View style={styles.divider} />
                <Text style={styles.cardKicker}>
                  YOUR GROUP · CHEMISTRY {result.plan.group.average_chemistry} AVG /{' '}
                  {result.plan.group.min_pair_chemistry} WEAKEST PAIR
                </Text>
                {result.plan.group.members.map((m) => (
                  <View key={m.user_id} style={styles.memberRow}>
                    <View style={styles.memberDot}>
                      <Text style={styles.memberInitial}>
                        {(m.full_name ?? '?').trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={styles.memberName}>{m.full_name ?? 'Waypoint member'}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleText}>{m.role}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {result.rejection_reasons.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardKicker}>WHY ATLAS SAID NO</Text>
                {result.rejection_reasons.map((reason) => (
                  <Text key={reason} style={styles.rejectionText}>
                    · {reason}
                  </Text>
                ))}
              </View>
            )}

            {result.verifier.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardKicker}>DETERMINISTIC VERIFIER</Text>
                {result.verifier.map((check) => (
                  <View key={check.id} style={styles.checkRow}>
                    <Ionicons
                      name={check.pass ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={check.pass ? '#2E9E5B' : check.severity === 'block' ? '#D64545' : '#C7822B'}
                    />
                    <View style={styles.checkBody}>
                      <Text style={styles.checkTitle}>{check.description}</Text>
                      <Text style={styles.checkDetail}>{check.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.footerMeta}>
              {result.meta.engine_version} · compiler {result.meta.compiler_kind}
              {result.meta.model_id ? ` (${result.meta.model_id})` : ''} ·{' '}
              {result.meta.embedding_version ?? 'no embeddings — deterministic retrieval'} · decision #
              {result.decision_id}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  backButton: { padding: 2 },
  title: { fontSize: 24, color: '#1A1A1A', flex: 1 },
  shadowBadge: {
    backgroundColor: '#EAE4F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shadowBadgeText: { color: '#6B4EAE', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 14 },
  lede: { color: '#8A8A85', fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: { minHeight: 96, fontSize: 16, color: '#1A1A1A', textAlignVertical: 'top' },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  tryDemo: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  counter: { color: '#A9A9A4', fontSize: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  loadingText: { color: '#8A8A85', fontSize: 13 },
  errorCard: { backgroundColor: '#FDECEC' },
  errorText: { color: '#B3261E', fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  statusProposed: { backgroundColor: '#DFF3E7' },
  statusRejected: { backgroundColor: '#FBE9E7' },
  statusPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#1A1A1A' },
  latency: { color: '#A9A9A4', fontSize: 12 },
  cardKicker: { color: '#8A8A85', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#F1F0EC',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: '#1A1A1A' },
  confidence: { marginTop: 10, fontSize: 12, color: '#A9A9A4' },
  questTitle: { fontSize: 22, color: '#1A1A1A', marginBottom: 6 },
  questDare: { fontSize: 15, color: '#1A1A1A', lineHeight: 21 },
  questWhy: { fontSize: 13, color: '#8A8A85', lineHeight: 19, marginTop: 6, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { fontSize: 13, color: '#8A8A85', flex: 1 },
  divider: { height: 1, backgroundColor: '#F1F0EC', marginVertical: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F1FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { color: '#0A5CE0', fontWeight: '700' },
  memberName: { flex: 1, fontSize: 15, color: '#1A1A1A' },
  roleBadge: {
    backgroundColor: '#F1F0EC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleText: { fontSize: 12, color: '#1A1A1A', fontWeight: '600' },
  rejectionText: { fontSize: 13, color: '#B3261E', lineHeight: 19, marginBottom: 4 },
  checkRow: { flexDirection: 'row', gap: 10, paddingVertical: 6, alignItems: 'flex-start' },
  checkBody: { flex: 1 },
  checkTitle: { fontSize: 13.5, color: '#1A1A1A', fontWeight: '600' },
  checkDetail: { fontSize: 12, color: '#8A8A85', marginTop: 1 },
  footerMeta: { textAlign: 'center', color: '#A9A9A4', fontSize: 11, marginTop: 2 },
});
