import { decode } from 'base64-arraybuffer';
import { Alert } from 'react-native';
import { waypointNotifications } from '~/modules/notifications';
import { supabase } from '~/utils/supabase';
import type { InterestId } from '~/utils/constants';
import { BioField } from './fields/BioField';
import { BirthdayField, calculateAge } from './fields/BirthdayField';
import { GenderField } from './fields/GenderField';
import { GenderPreferenceField } from './fields/GenderPreferenceField';
import { InterestsField } from './fields/InterestsField';
import { LanguagesField } from './fields/LanguagesField';
import { LocationIntroBody } from './fields/LocationIntroBody';
import { detectCurrentCity, LocationField, type LocationValue } from './fields/LocationField';
import { NameField } from './fields/NameField';
import { NationalityField, type NationalityValue } from './fields/NationalityField';
import { NotificationsBody } from './fields/NotificationsBody';
import { PauseBody } from './fields/PauseBody';
import { PictureField, type PictureValue } from './fields/PictureField';
import { PreferencesField } from './fields/PreferencesField';
import { RatingBody, requestWaypointReview, TakeABowBody } from './fields/FinaleBodies';
import { TripsCustom } from './fields/TripsCustom';
import { StepCancelled, type StepDef } from './types';

async function uploadAvatar(userId: string, base64: string): Promise<string> {
  // Per-user folder so the owner-scoped storage policy matches ((foldername)[1] = uid).
  const fileName = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(fileName, decode(base64), {
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
 * Prompts the user to confirm their age before persisting the birthday.
 * Resolves true on confirm, false on cancel. Inspired by Swarm's
 * "Are you X years old?" sheet.
 */
function confirmAge(birthDateISO: string): Promise<boolean> {
  const age = calculateAge(new Date(birthDateISO));
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      `Are you ${age} years old?`,
      'Please confirm your correct birthday — we require it to allow use of Waypoint.',
      [
        {
          text: 'No, I entered the wrong birthday',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        { text: 'Yes, I confirm', onPress: () => resolve(true) },
      ],
      { cancelable: false }
    );
  });
}

/**
 * The 14-step onboarding flow, in order. Reordering this array reorders
 * the flow. The slug is the URL segment under /onboarding/.
 */
export const ONBOARDING_SEQUENCE: readonly StepDef<any>[] = [
  {
    slug: 'name',
    title: 'What should we call you?',
    Body: NameField,
    hideCta: true,
    read: (p): string | undefined => p.full_name ?? undefined,
    isValid: (v: string | undefined) => !!v?.trim(),
    commit: async (v: string | undefined) => ({
      full_name: v?.trim() ?? null,
    }),
  },
  {
    slug: 'birthday',
    title: "When's your birthday?",
    subtitle: 'We require your birthday to keep Waypoint a safe place :)',
    Body: BirthdayField,
    read: (p): string | undefined => p.birth_date ?? undefined,
    isValid: (v: string | undefined) => !!v,
    commit: async (v: string | undefined) => {
      if (!v) throw new StepCancelled('No birthday set');
      const ok = await confirmAge(v);
      if (!ok) throw new StepCancelled('User declined age confirmation');
      return { birth_date: v };
    },
  },
  {
    slug: 'nationality',
    title: 'Where are you from?',
    subtitle: 'This is about your background, not where you are right now.',
    Body: NationalityField,
    read: (p): NationalityValue | undefined =>
      p.nationality_code ? { code: p.nationality_code, name: p.nationality ?? '' } : undefined,
    isValid: (v: NationalityValue | undefined) => !!v?.code,
    commit: async (v: NationalityValue | undefined) => ({
      nationality_code: v?.code ?? null,
      nationality: v?.name ?? null,
    }),
  },
  {
    slug: 'gender',
    title: 'Tell us who you are',
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
    read: (p) => (Array.isArray(p.interests) ? (p.interests as InterestId[]) : undefined),
    isValid: (v: InterestId[] | undefined) => Array.isArray(v) && v.length > 0,
    commit: async (v: InterestId[] | undefined, { skipped }) => ({
      interests: skipped ? [] : (v ?? []),
    }),
  },
  {
    slug: 'pause',
    title: "you're almost\nthere!",
    subtitle: "Just a few more steps and you'll be ready to start making connections.",
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
    read: (p) => (Array.isArray(p.languages) ? (p.languages as string[]) : undefined),
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
    isValid: (v: string | undefined) => typeof v === 'string' && v.trim().length > 0,
    commit: async (v: string | undefined, { skipped }) => ({
      bio: skipped ? null : (v?.trim() ?? null),
    }),
  },
  {
    slug: 'preferences',
    title: 'how do you prefer to\nmeet people?',
    subtitle: 'helps us suggest the right kind of plans',
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
    subtitle: 'this helps keep your suggestions relevant',
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
    slug: 'location-intro',
    title: 'Share your world,\nmeet better',
    hideHeader: true,
    noScroll: true,
    Body: LocationIntroBody,
    read: () => undefined,
    isValid: () => true,
    commit: async () => ({}),
    continueLabel: "I'm based in...",
  },
  {
    slug: 'location',
    title: 'Find people near\nyour plans',
    noScroll: true,
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
    commit: async (v: LocationValue | undefined) => {
      const location = v ?? (await detectCurrentCity());
      return {
        location: location.city,
        location_country: location.country,
        location_country_code: location.country_code,
        location_updated_at: new Date().toISOString(),
      };
    },
  },
  {
    slug: 'notifications',
    title: 'Turn on notifications',
    skippable: true,
    hideHeader: true,
    Body: NotificationsBody,
    read: () => undefined,
    isValid: () => true,
    commit: async (_value, { skipped, userId }) => {
      if (skipped) return {};

      try {
        const access = await waypointNotifications.requestAccess({
          userId,
          source: 'onboarding',
        });
        if (access.permission === 'granted' || access.permission === 'provisional') {
          await waypointNotifications.sync({
            userId,
            reason: 'onboarding-accepted',
          });
        }
      } catch (err) {
        console.warn('Notification onboarding setup failed:', err);
      }

      return {};
    },
  },
  {
    slug: 'rating',
    title: 'ENJOYING THE APP?',
    hideHeader: true,
    noScroll: true,
    Body: RatingBody,
    read: () => undefined,
    isValid: () => true,
    commit: async () => {
      await requestWaypointReview();
      return {};
    },
    continueLabel: 'Continue',
  },
  {
    slug: 'take-a-bow',
    title: 'Take a bow',
    hideHeader: true,
    noScroll: true,
    Body: TakeABowBody,
    read: () => undefined,
    isValid: () => true,
    commit: async () => ({}),
  },
];

/** Map slugs to their index in the sequence. */
export const STEP_INDEX: Record<string, number> = ONBOARDING_SEQUENCE.reduce(
  (acc, step, i) => {
    acc[step.slug] = i;
    return acc;
  },
  {} as Record<string, number>
);

/** Slug of the first step, used by the auth controller for redirects. */
export const FIRST_STEP_SLUG = ONBOARDING_SEQUENCE[0].slug;
