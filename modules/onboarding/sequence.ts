// The canonical order for both persisted progress and screen rendering.
// Keep this module dependency-free: the root navigation gate reads it at boot,
// before native onboarding fields such as react-native-date-picker can load.
export const ONBOARDING_SEQUENCE = [
  'name',
  'birthday',
  'nationality',
  'gender',
  'interests',
  'pause',
  'picture',
  'languages',
  'bio',
  'preferences',
  'gender-preference',
  'trips',
  'location-intro',
  'location',
  'notifications',
  'rating',
  'take-a-bow',
] as const;

export type OnboardingSlug = (typeof ONBOARDING_SEQUENCE)[number];

export const FIRST_STEP_SLUG = ONBOARDING_SEQUENCE[0];

/** Find only real stages, including when a deep link supplies an unknown slug. */
export function getOnboardingStepIndex(slug: string): number | undefined {
  const index = ONBOARDING_SEQUENCE.findIndex((candidate) => candidate === slug);
  return index === -1 ? undefined : index;
}

/** Clamp persisted progress to a stage that can be rendered. */
export function getOnboardingResumeSlug(persistedStep: number): OnboardingSlug {
  const index = Number.isFinite(persistedStep) ? Math.trunc(persistedStep) : 0;
  return ONBOARDING_SEQUENCE[Math.max(0, Math.min(index, ONBOARDING_SEQUENCE.length - 1))];
}
