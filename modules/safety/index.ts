// modules/safety/index.ts
//
// Block + report helpers (Apple App Store Guideline 1.2 — UGC safety).
//
// Blocking writes to public.blocked_users (RLS already allows the blocker to
// manage their own list). Discovery RPCs and the DM-create RPC honour blocks in
// both directions, so a block immediately hides each user from the other.
//
// Reporting writes to public.reports (see 20260613120000_create_reports_table.sql).
// Reports are reviewed out of band via the service role.

import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '~/utils/supabase';

export type ReportTargetType = 'user' | 'message' | 'event' | 'conversation';

export const REPORT_REASONS = [
  'Harassment or bullying',
  'Inappropriate or sexual content',
  'Spam or scam',
  'Fake profile or impersonation',
  'Underage user',
  'Safety concern or threat',
  'Something else',
] as const;

/** Inserts (or refreshes) a block. Returns true on success. */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string
): Promise<boolean> {
  if (!blockerId || !blockedId || blockerId === blockedId) return false;
  const { error } = await supabase
    .from('blocked_users')
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId, reason: reason ?? null },
      { onConflict: 'blocker_id,blocked_id' }
    );
  if (error) {
    console.error('Failed to block user:', error);
    return false;
  }
  return true;
}

/** Files a report. Returns true on success. */
export async function submitReport(
  reporterId: string,
  params: {
    reportedUserId?: string | null;
    targetType: ReportTargetType;
    targetId?: string | number | null;
    reason: string;
    details?: string | null;
  }
): Promise<boolean> {
  if (!reporterId) return false;
  // `reports` isn't in the generated Database types yet — cast until
  // types/supabase.ts is regenerated against 20260613120000_create_reports_table.sql.
  const { error } = await (supabase as any).from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: params.reportedUserId ?? null,
    target_type: params.targetType,
    target_id: params.targetId != null ? String(params.targetId) : null,
    reason: params.reason,
    details: params.details ?? null,
  });
  if (error) {
    console.error('Failed to submit report:', error);
    return false;
  }
  return true;
}

/** Confirm-then-block dialog. */
export function confirmBlock(opts: {
  blockerId: string;
  blockedId: string;
  name?: string | null;
  onBlocked?: () => void;
}) {
  const label = opts.name?.trim() || 'this user';
  Alert.alert(
    `Block ${label}?`,
    `${label} won't be able to message you or see your profile, and you won't see them. You can unblock anytime from Settings › Privacy.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const ok = await blockUser(opts.blockerId, opts.blockedId);
          if (ok) {
            Alert.alert('Blocked', `You have blocked ${label}.`);
            opts.onBlocked?.();
          } else {
            Alert.alert('Error', 'Could not block this user. Please try again.');
          }
        },
      },
    ]
  );
}

/** Opens the report screen for a given target. */
export function openReport(params: {
  targetType: ReportTargetType;
  targetId?: string | number | null;
  reportedUserId?: string | null;
  name?: string | null;
}) {
  router.push({
    // Cast: typed-routes may not know about /report until route types regenerate.
    pathname: '/report' as any,
    params: {
      type: params.targetType,
      id: params.targetId != null ? String(params.targetId) : '',
      userId: params.reportedUserId ?? '',
      name: params.name ?? '',
    },
  });
}

/**
 * Action sheet for a user: Block / Report / Cancel. Used from a profile's
 * overflow menu and from a DM header. Exactly three options so it renders
 * correctly on both iOS and Android.
 */
export function presentUserSafetyActions(opts: {
  currentUserId: string;
  targetUserId: string;
  targetName?: string | null;
  onBlocked?: () => void;
}) {
  const label = opts.targetName?.trim() || 'this user';
  Alert.alert(label, undefined, [
    {
      text: 'Block',
      style: 'destructive',
      onPress: () =>
        confirmBlock({
          blockerId: opts.currentUserId,
          blockedId: opts.targetUserId,
          name: opts.targetName,
          onBlocked: opts.onBlocked,
        }),
    },
    {
      text: 'Report',
      onPress: () =>
        openReport({
          targetType: 'user',
          reportedUserId: opts.targetUserId,
          name: opts.targetName,
        }),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
