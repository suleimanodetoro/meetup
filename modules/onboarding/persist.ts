import { supabase } from '~/utils/supabase';
import type { ProfilePatch, ProfileRow } from './types';

/** Read the entire profile row for the current user. */
export async function loadProfile(userId: string): Promise<Partial<ProfileRow>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // PGRST116 = no row. The trigger should have inserted one already, but
    // be defensive: an empty draft is fine to proceed from.
    if (error.code === 'PGRST116') return {};
    throw error;
  }
  return data ?? {};
}

/**
 * Write a step's patch and bump `onboarding_step`. On the terminal step,
 * also set `onboarding_completed = true`. One UPDATE per step keeps the
 * resume-on-reopen invariant honest.
 */
export async function commitStep(
  userId: string,
  stepIndex: number,
  totalSteps: number,
  patch: ProfilePatch,
): Promise<void> {
  const isTerminal = stepIndex === totalSteps - 1;
  const fullPatch: ProfilePatch = {
    ...patch,
    onboarding_step: stepIndex + 1,
    updated_at: new Date().toISOString(),
    ...(isTerminal ? { onboarding_completed: true } : {}),
  };

  const { error } = await supabase
    .from('profiles')
    .update(fullPatch)
    .eq('id', userId);

  if (error) throw error;
}
