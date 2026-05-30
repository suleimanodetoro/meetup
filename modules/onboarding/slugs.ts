// modules/onboarding/slugs.ts
//
// Pure-string list of onboarding URL slugs in order. Lives in its own file
// (no component imports) so app/_layout.tsx can read the resume slug at
// boot without pulling react-native-date-picker (BirthdayField, TripsCustom)
// or any other field component into the initial bundle. Dragging those in
// at module-load was crashing the app with `requireNativeComponent`
// nullthrows when the native view config wasn't registered yet.
//
// Order MUST match ONBOARDING_SEQUENCE in ./sequence.ts. Reordering or
// adding/removing slugs requires the same change in both files.

export const ONBOARDING_SLUGS = [
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
  'location',
  'notifications',
] as const;

export type OnboardingSlug = (typeof ONBOARDING_SLUGS)[number];
