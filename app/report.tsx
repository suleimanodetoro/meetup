// app/report.tsx
//
// Report screen (Apple App Store Guideline 1.2 — a way for users to flag
// objectionable users/content). Reachable from a profile's overflow menu,
// a DM header, and a group-plan's "Report" action via modules/safety.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '~/contexts/AuthProvider';
import {
  REPORT_REASONS,
  confirmBlock,
  submitReport,
  type ReportTargetType,
} from '~/modules/safety';
import { authColors, authRadius, authSpace, authType } from '~/utils/authTheme';

const TARGET_LABEL: Record<ReportTargetType, string> = {
  user: 'this person',
  message: 'this message',
  event: 'this plan',
  conversation: 'this conversation',
};

export default function ReportScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    userId?: string;
    name?: string;
  }>();

  const targetType = (params.type as ReportTargetType) || 'user';
  const reportedUserId = params.userId ? String(params.userId) : null;
  const targetId = params.id ? String(params.id) : null;
  const name = params.name ? String(params.name) : '';
  const subject = name.trim() || TARGET_LABEL[targetType] || 'this';

  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reporterId = session?.user?.id;

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    if (!reporterId) {
      Alert.alert('Sign in required', 'Please sign in again to submit a report.');
      return;
    }

    setSubmitting(true);
    const ok = await submitReport(reporterId, {
      reportedUserId,
      targetType,
      targetId,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);

    if (!ok) {
      Alert.alert('Could not send report', 'Something went wrong. Please try again.');
      return;
    }

    // Offer to block when reporting a person, so abuse can be stopped in one flow.
    if (targetType === 'user' && reportedUserId) {
      Alert.alert(
        'Report received',
        'Thanks — our team will review this. Would you also like to block this person so they can no longer contact you?',
        [
          { text: 'Not now', style: 'cancel', onPress: () => router.back() },
          {
            text: 'Block',
            style: 'destructive',
            onPress: () =>
              confirmBlock({
                blockerId: reporterId,
                blockedId: reportedUserId,
                name,
                onBlocked: () => router.back(),
              }),
          },
        ]
      );
      return;
    }

    Alert.alert('Report received', 'Thanks — our team will review this.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
          <Ionicons name="close" size={26} color={authColors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Report</Text>
        <View style={styles.closeButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.prompt}>Why are you reporting {subject}?</Text>
          <Text style={styles.helper}>
            Your report is confidential. We review reports and may remove content or accounts that
            break our rules.
          </Text>

          <View style={styles.reasons}>
            {REPORT_REASONS.map((option) => {
              const selected = reason === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                  onPress={() => setReason(option)}>
                  <Text style={styles.reasonText}>{option}</Text>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? authColors.accent : authColors.textTertiary}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.detailsLabel}>Add details (optional)</Text>
          <TextInput
            style={styles.detailsInput}
            value={details}
            onChangeText={setDetails}
            placeholder="Tell us what happened…"
            placeholderTextColor={authColors.placeholder}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.submit, (!reason || submitting) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!reason || submitting}>
            {submitting ? (
              <ActivityIndicator color={authColors.ctaPrimaryText} />
            ) : (
              <Text style={styles.submitText}>Submit report</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: authColors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: authSpace.lg,
    paddingTop: authSpace.xs,
    paddingBottom: authSpace.md,
  },
  closeButton: { width: 30, height: 30, justifyContent: 'center', alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700', color: authColors.textPrimary },
  content: { paddingHorizontal: authSpace.xl, paddingBottom: authSpace.xxl },
  prompt: {
    fontSize: 22,
    fontWeight: '700',
    color: authColors.textPrimary,
    marginTop: authSpace.sm,
    marginBottom: authSpace.sm,
    letterSpacing: -0.3,
  },
  helper: {
    fontSize: authType.body.fontSize,
    lineHeight: authType.body.lineHeight,
    color: authColors.textSecondary,
    marginBottom: authSpace.lg,
  },
  reasons: { gap: authSpace.sm },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: authSpace.lg,
    borderRadius: authRadius.input,
    borderWidth: 1,
    borderColor: authColors.borderSubtle,
    backgroundColor: authColors.surface,
  },
  reasonRowSelected: {
    borderColor: authColors.accent,
    backgroundColor: authColors.accentSoft,
  },
  reasonText: { fontSize: 16, fontWeight: '500', color: authColors.textPrimary, flex: 1 },
  detailsLabel: {
    fontSize: authType.label.fontSize,
    fontWeight: authType.label.fontWeight,
    color: authColors.textSecondary,
    marginTop: authSpace.xl,
    marginBottom: authSpace.sm,
  },
  detailsInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: authColors.inputBorder,
    borderRadius: authRadius.input,
    padding: authSpace.lg,
    fontSize: 16,
    color: authColors.textPrimary,
  },
  footer: {
    paddingHorizontal: authSpace.xl,
    paddingTop: authSpace.md,
    paddingBottom: authSpace.lg,
    borderTopWidth: 1,
    borderTopColor: authColors.borderMuted,
  },
  submit: {
    backgroundColor: authColors.ctaPrimaryBg,
    paddingVertical: 16,
    borderRadius: authRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: authColors.ctaPrimaryText, fontSize: 17, fontWeight: '600' },
});
