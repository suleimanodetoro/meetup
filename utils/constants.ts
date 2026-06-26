// utils/constants.ts

// ============= INTERESTS =============
export const INTERESTS = [
  { id: 'music', label: 'Music', emoji: '🎶' },
  { id: 'gaming', label: 'Esports', emoji: '🎮' },
  { id: 'raves', label: 'Raves', emoji: '🪩' },
  { id: 'partying', label: 'Partying', emoji: '🥳' },
  { id: 'dance', label: 'Dance Nights', emoji: '💃' },
  { id: 'fitness', label: 'Group Fitness', emoji: '🏋️‍♂️' },
  { id: 'yoga', label: 'Yoga & Mindfulness', emoji: '🧘‍♀️' },
  { id: 'foodie', label: 'Food', emoji: '🍣' },
  { id: 'coffee', label: 'Coffee & Chill', emoji: '☕' },
  { id: 'arts', label: 'Arts & Crafts', emoji: '🎨' },
  { id: 'photography', label: 'Photography Walks', emoji: '📸' },
  { id: 'boardgames', label: 'Game Nights', emoji: '🎲' },
  { id: 'karaoke', label: 'Karaoke', emoji: '🎤' },
  { id: 'outdoor', label: 'Outdoor', emoji: '🌳' },
  { id: 'volunteer', label: 'Volunteering', emoji: '🤝' },
  { id: 'film', label: 'Movie Nights', emoji: '🎬' },
  { id: 'fashion', label: 'Fashion', emoji: '🛍️' },
  { id: 'tech', label: 'Tech Meetups', emoji: '💻' },
  { id: 'skate', label: 'Skateboarding', emoji: '🛹' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'bookclub', label: 'Book Club', emoji: '📚' },
  { id: 'creative', label: 'Writing', emoji: '✏️' },
  { id: 'thrill', label: 'Adventure', emoji: '🎢' },
] as const;

export const INTEREST_LABELS = INTERESTS.map((i) => i.label);

// Helper to get emoji from label or id
export const getInterestEmoji = (labelOrId: string): string => {
  const interest = INTERESTS.find(
    (i) => i.label.toLowerCase() === labelOrId.toLowerCase() || i.id === labelOrId.toLowerCase()
  );
  return interest?.emoji || '✨';
};

export type InterestId = (typeof INTERESTS)[number]['id'];

// ============= LANGUAGES =============
export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'zh', name: 'Mandarin Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
  { code: 'fa', name: 'Persian (Farsi)', flag: '🇮🇷' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'el', name: 'Greek', flag: '🇬🇷' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
] as const;

export type Interest = (typeof INTERESTS)[number]; // item type

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

// Sorted copy with correct typing (not a tuple anymore)
export const SORTED_INTERESTS: readonly Interest[] = [...INTERESTS].sort((a, b) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
);

// ============= MEETING PREFERENCES =============
export const MEETING_PREFERENCES = [
  { id: 'go-together', label: 'Go together', emoji: '🚕' },
  { id: 'meet-there', label: 'Meet up there', emoji: '📍' },
  { id: 'chat-first', label: 'Message before making plans', emoji: '💬' },
  { id: 'no-plans', label: 'No plans to meet yet', emoji: '✨' }
];

export type MeetingPreferenceId = (typeof MEETING_PREFERENCES)[number]['id'];

// ============= GENDER OPTIONS =============
// Canonical gender set. Must stay in sync with the profiles.gender CHECK
// constraint (see migration 20260626120000_widen_profiles_gender_check.sql) and
// the onboarding selector (modules/onboarding/fields/GenderField.tsx, which
// labels 'male'/'female' as Man/Woman and hides the last three behind "+ More").
export const GENDER_OPTIONS = [
  { id: 'male', label: 'Man', emoji: '🙋‍♂️' },
  { id: 'female', label: 'Woman', emoji: '🙋‍♀️' },
  { id: 'non-binary', label: 'Non-binary', emoji: '🌈' },
  { id: 'other', label: 'Other', emoji: '🦄' },
  { id: 'prefer-not-to-say', label: 'Prefer not to say', emoji: '🤐' },
] as const;

export type GenderId = (typeof GENDER_OPTIONS)[number]['id'];

// ============= GENDER PREFERENCES =============
export const GENDER_PREFERENCES = [
  { id: 'guys', label: 'Only Guys', emoji: '🧔' },
  { id: 'girls', label: 'Only Girls', emoji: '👩' },
  { id: 'everyone', label: 'Everyone', emoji: '👫' },
] as const;

export type GenderPreferenceId = (typeof GENDER_PREFERENCES)[number]['id'];

// ============= TRAVEL LIFESTYLES =============
export const TRAVEL_LIFESTYLES = [
  { id: 'digital-nomad', label: 'Digital nomad', emoji: '💻' },
  { id: 'backpacker', label: 'Backpacker', emoji: '🎒' },
  { id: 'luxury', label: 'Luxury traveler', emoji: '✨' },
  { id: 'weekend', label: 'Weekend explorer', emoji: '🗓️' },
  { id: 'adventure', label: 'Adventure seeker', emoji: '🏔️' },
] as const;

export type TravelLifestyleId = (typeof TRAVEL_LIFESTYLES)[number]['id'];

// ============= COMMUNITY GUIDELINES =============
export const COMMUNITY_GUIDELINES = [
  'No illegal activity',
  'No hate speech or harassment',
  "Don't mislead on price or details",
  'Respect venue rules and staff',
  'Share accurate time and place',
  "You'll coordinate any changes",
] as const;
