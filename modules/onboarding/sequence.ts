import { decode } from 'base64-arraybuffer';
import * as Notifications from 'expo-notifications';
import { supabase } from '~/utils/supabase';
import type { InterestId } from '~/utils/constants';
import { BasicField, type BasicValue } from './fields/BasicField';
import { BioField } from './fields/BioField';
import { GenderField } from './fields/GenderField';
import { GenderPreferenceField } from './fields/GenderPreferenceField';
import { InterestsField } from './fields/InterestsField';
import { LanguagesField } from './fields/LanguagesField';
import { LocationField, type LocationValue } from './fields/LocationField';
import { NationalityField, type NationalityValue } from './fields/NationalityField';
import { NotificationsBody } from './fields/NotificationsBody';
import { PauseBody } from './fields/PauseBody';
import { PictureField, type PictureValue } from './fields/PictureField';
import { PreferencesField } from './fields/PreferencesField';
import { TripsCustom } from './fields/TripsCustom';
import type { StepDef } from './types';

async function uploadAvatar(
  userId: string,
  base64: string,
): Promise<string> {
  const fileName = `${userId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(fileName, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return publicUrl;
}

/**
 * The 13-step onboarding flow, in order. Reordering this array reorders
 * the flow. The slug is the URL segment under /onboarding/.
 */
export const ONBOARDING_SEQUENCE: readonly StepDef<any>[] = [
  {
    slug: 'basic',
    title: 'basic info',
    subtitle: "let's get started with your profile 🤝",
    Body: BasicField,
    read: (p): BasicValue | undefined => {
      if (!p.full_name && !p.birth_date) return undefined;
      return {
        full_name: p.full_name ?? '',
        birth_date: p.birth_date ?? '',
      };
    },
    isValid: (v: BasicValue | undefined) =>
      !!v?.full_name?.trim() && !!v.birth_date,
    commit: async (v: BasicValue | undefined) => ({
      full_name: v?.full_name.trim() ?? null,
      birth_date: v?.birth_date ?? null,
    }),
  },
  {
    slug: 'nationality',
    title: 'where are you from?',
    subtitle: 'Helps us connect you with people around the world 👋',
    Body: NationalityField,
    read: (p): NationalityValue | undefined =>
      p.nationality_code
        ? { code: p.nationality_code, name: p.nationality ?? '' }
        : undefined,
    isValid: (v: NationalityValue | undefined) => !!v?.code,
    commit: async (v: NationalityValue | undefined) => ({
      nationality_code: v?.code ?? null,
      nationality: v?.name ?? null,
    }),
  },
  {
    slug: 'gender',
    title: "what's your gender?",
    subtitle: 'helps us connect you with the right people 🤝',
    Body: GenderField,
    read: (p) => p.gender ?? undefined,
    isValid: (v: string | undefined) => !!v,
    commit: async (v: string | undefined) => ({ gender: v ?? null }),
  },
  {
    slug: 'interests',
    title: 'select up to 5\ninterests',
    subtitle: 'connect with people who share your vibe 🤝',
    skippable: true,
    Body: InterestsField,
    read: (p) =>
      Array.isArray(p.interests) ? (p.interests as InterestId[]) : undefined,
    isValid: (v: InterestId[] | undefined) => Array.isArray(v) && v.length > 0,
    commit: async (v: InterestId[] | undefined, { skipped }) => ({
      interests: skipped ? [] : (v ?? []),
    }),
  },
  {
    slug: 'pause',
    title: "you're almost\nthere!",
    subtitle:
      "Just a few more steps and you'll be ready to start making connections.",
    Body: PauseBody,
    read: () => undefined,
    isValid: () => true,
    commit: async () => ({}),
  },
  {
    slug: 'picture',
    title: 'add a picture',
    subtitle: 'let others know what you look like 📸',
    skippable: true,
    Body: PictureField,
    read: (p): PictureValue | undefined =>
      p.avatar_url ? { uri: p.avatar_url, base64: null } : undefined,
    isValid: () => true,
    commit: async (v: PictureValue | undefined, { userId, skipped }) => {
      if (skipped || !v) return { avatar_url: null };
      // If the user kept the existing picture (base64 is null but uri is set),
      // don't re-upload — just preserve the URL.
      if (!v.base64) return { avatar_url: v.uri };
      const url = await uploadAvatar(userId, v.base64);
      return { avatar_url: url };
    },
  },
  {
    slug: 'languages',
    title: 'languages you speak',
    subtitle: 'select all that apply 🌍',
    skippable: true,
    Body: LanguagesField,
    read: (p) =>
      Array.isArray(p.languages) ? (p.languages as string[]) : undefined,
    isValid: (v: string[] | undefined) => Array.isArray(v) && v.length > 0,
    commit: async (v: string[] | undefined, { skipped }) => ({
      languages: skipped ? ['en'] : (v ?? ['en']),
    }),
  },
  {
    slug: 'bio',
    title: 'tell us about yourself',
    subtitle: 'what should people know 👀',
    skippable: true,
    Body: BioField,
    read: (p) => p.bio ?? undefined,
    isValid: (v: string | undefined) =>
      typeof v === 'string' && v.trim().length > 0,
    commit: async (v: string | undefined, { skipped }) => ({
      bio: skipped ? null : (v?.trim() ?? null),
    }),
  },
  {
    slug: 'preferences',
    title: 'how do you prefer to\nmeet people?',
    subtitle: 'helps us suggest the right connections 🤝',
    Body: PreferencesField,
    read: (p) => p.meeting_preference ?? undefined,
    isValid: (v: string | undefined) => !!v,
    commit: async (v: string | undefined) => ({
      meeting_preference: v ?? null,
    }),
  },
  {
    slug: 'gender-preference',
    title: 'who do you want to\nmeet?',
    subtitle: 'you will only receive messages from this gender 😎',
    Body: GenderPreferenceField,
    read: (p) => p.gender_preference ?? undefined,
    isValid: (v: string | undefined) => !!v,
    commit: async (v: string | undefined) => ({
      gender_preference: v ?? null,
    }),
  },
  {
    slug: 'trips',
    title: 'any upcoming trips?',
    subtitle:
      'got a visit planned? add it here to match with other people going to the same place!',
    skippable: true,
    custom: TripsCustom,
  },
  {
    slug: 'location',
    title: 'where do you live?',
    subtitle: 'so we can show you people and plans nearby',
    skippable: true,
    Body: LocationField,
    read: (p): LocationValue | undefined =>
      p.location
        ? {
            city: p.location,
            country: p.location_country ?? null,
            country_code: p.location_country_code ?? null,
          }
        : undefined,
    isValid: () => true,
    commit: async (v: LocationValue | undefined, { skipped }) => {
      if (skipped || !v) return {};
      return {
        location: v.city,
        location_country: v.country,
        location_country_code: v.country_code,
        location_updated_at: new Date().toISOString(),
      };
    },
  },
  {
    slug: 'notifications',
    title: 'enable notifications',
    subtitle: 'stay connected with your messages and activity',
    skippable: true,
    Body: NotificationsBody,
    read: () => undefined,
    isValid: () => true,
    commit: async (_value, { skipped }) => {
      if (skipped) return {};
      await Notifications.requestPermissionsAsync();
      // Outcome isn't persisted — onboarding-notifications.tsx never did
      // either. The OS records the permission decision.
      return {};
    },
  },
];

/** Map slugs to their index in the sequence. */
export const STEP_INDEX: Record<string, number> = ONBOARDING_SEQUENCE.reduce(
  (acc, step, i) => {
    acc[step.slug] = i;
    return acc;
  },
  {} as Record<string, number>,
);

/** Slug of the first step, used by the auth controller for redirects. */
export const FIRST_STEP_SLUG = ONBOARDING_SEQUENCE[0].slug;
