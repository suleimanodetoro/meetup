import type { ComponentType } from 'react';
import type { Database } from '~/types/supabase';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfilePatch = Database['public']['Tables']['profiles']['Update'];

/** Props passed to a step's body component. */
export interface StepBodyProps<V> {
  value: V | undefined;
  setValue: (next: V | undefined) => void;
  /**
   * The persisted profile row at mount. Use for cross-step reads
   * (e.g. interests-suggest-based-on-nationality). Mutating it does nothing;
   * write only via `setValue` and let `commit` persist on Continue.
   */
  draft: Readonly<Partial<ProfileRow>>;
}

/** Context handed to a step's `commit` function. */
export interface CommitCtx {
  userId: string;
  /** True when the user pressed Skip instead of Continue. */
  skipped: boolean;
}

/** Context handed to a `custom`-takeover step. */
export interface CustomStepProps {
  step: StepDef;
  draft: Readonly<Partial<ProfileRow>>;
  userId: string;
  /**
   * Persist a patch to `profiles` (if non-empty), bump `onboarding_step`,
   * then navigate to the next step in the sequence. If on the last step,
   * sets `onboarding_completed = true` and triggers AuthProvider refresh.
   */
  advance: (patch?: ProfilePatch) => Promise<void>;
  goBack: () => void;
}

export interface StepDef<V = unknown> {
  /** URL segment under /onboarding/. Also serves as identity. */
  slug: string;
  title: string;
  subtitle?: string;
  /** When true, the header shows Skip alongside Back. */
  skippable?: boolean;

  /** The body slot. Ignored when `custom` is provided. */
  Body?: ComponentType<StepBodyProps<V>>;
  /** Extract this step's initial value from the persisted profile row. */
  read?: (profile: Partial<ProfileRow>) => V | undefined;
  /** Gates the Continue button. */
  isValid?: (value: V | undefined) => boolean;
  /**
   * Runs on Continue (and on Skip with `ctx.skipped: true`). May upload to
   * Storage, insert into auxiliary tables, request permissions, etc. The
   * returned patch is merged into `profiles` in the same UPDATE that bumps
   * `onboarding_step`. Return `{}` if the step has no profile-row effect.
   */
  commit?: (value: V | undefined, ctx: CommitCtx) => Promise<ProfilePatch>;

  /**
   * Full-takeover body. When set, Body/read/isValid/commit are ignored and
   * the custom component owns navigation via `advance` / `goBack`. Use
   * sparingly — meant for steps that don't fit the "field → patch" shape
   * (e.g. trips, which writes to `visits` not `profiles`). Hard-cap at 2
   * customs across the whole sequence; a 3rd is a design smell.
   */
  custom?: ComponentType<CustomStepProps>;
}

/** What `commit` may return. `null` is treated as `{}`. */
export type CommitReturn = ProfilePatch | void | null;

/** Convenience type guard used by the runner. */
export function isCustomStep(step: StepDef): step is StepDef & {
  custom: ComponentType<CustomStepProps>;
} {
  return typeof step.custom === 'function';
}
