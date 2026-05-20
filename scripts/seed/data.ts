// Constants shared across seed scripts. Values match the app's enums in
// utils/constants.ts and the CHECK constraints in supabase/migrations.

export type City = {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
};

export const CITIES: City[] = [
  { name: 'London', country: 'United Kingdom', countryCode: 'GB', lat: 51.5074, lng: -0.1278 },
  { name: 'New York', country: 'United States', countryCode: 'US', lat: 40.7128, lng: -74.006 },
  { name: 'Lagos', country: 'Nigeria', countryCode: 'NG', lat: 6.5244, lng: 3.3792 },
  { name: 'Berlin', country: 'Germany', countryCode: 'DE', lat: 52.52, lng: 13.405 },
  { name: 'Tokyo', country: 'Japan', countryCode: 'JP', lat: 35.6762, lng: 139.6503 },
  { name: 'Mexico City', country: 'Mexico', countryCode: 'MX', lat: 19.4326, lng: -99.1332 },
];

// Subset of utils/constants.ts INTERESTS that the seed picks from.
export const INTEREST_IDS = [
  'music', 'gaming', 'raves', 'partying', 'dance', 'fitness', 'yoga',
  'foodie', 'coffee', 'arts', 'photography', 'boardgames', 'karaoke',
  'outdoor', 'volunteer', 'film', 'fashion', 'tech', 'skate', 'sports',
  'bookclub', 'creative', 'thrill',
];

export const LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'ja', 'pt', 'ar', 'ko'];

export const GENDERS = ['male', 'female', 'other'] as const;
export const GENDER_PREFS = ['guys', 'girls', 'everyone'] as const;
export const MEETING_PREFS = ['go-together', 'meet-there', 'chat-first', 'no-plans'] as const;

// Plan/event templates per interest theme — picked when an event is generated.
export const EVENT_TEMPLATES = [
  { title: 'Sunset run + smoothie', desc: 'Easy 5K, then we hit the juice bar.', interest: 'fitness' },
  { title: 'Speciality coffee crawl', desc: 'Three roasters in three hours.', interest: 'coffee' },
  { title: 'Indie film + dinner', desc: 'A24 picture and ramen after.', interest: 'film' },
  { title: 'Board games night', desc: 'BYO snacks. Catan, Codenames, Dixit.', interest: 'boardgames' },
  { title: 'Photo walk old town', desc: 'Golden hour, bring whatever camera.', interest: 'photography' },
  { title: 'Saturday hike', desc: '12K loop, moderate pace, dog-friendly.', interest: 'outdoor' },
  { title: 'Karaoke + late dinner', desc: 'Private booth, two hours, songs are non-negotiable.', interest: 'karaoke' },
  { title: 'Live music night', desc: 'Local band, intimate venue.', interest: 'music' },
  { title: 'Yoga in the park', desc: 'Mats provided, all levels.', interest: 'yoga' },
  { title: 'Tech meetup: AI', desc: 'Two lightning talks and pizza.', interest: 'tech' },
  { title: 'Brunch + gallery', desc: 'Cold pastries then a contemporary show.', interest: 'arts' },
  { title: 'Pickup football', desc: '5-a-side, all levels, friendly.', interest: 'sports' },
  { title: 'Volunteer beach cleanup', desc: 'Two hours, gloves provided.', interest: 'volunteer' },
  { title: 'Book club: latest pick', desc: 'We meet, we argue about a novel.', interest: 'bookclub' },
  { title: 'Skate session', desc: 'Bowl + flat ground, beginners welcome.', interest: 'skate' },
  { title: 'Rave warmup pres', desc: 'Drinks before the 11pm set.', interest: 'raves' },
];

export const MESSAGE_OPENERS = [
  'hey!', 'nice to match', 'how was your week?', 'are you around this weekend?',
  'thought of you when I saw this', 'have you been before?', 'one of my favourites',
  'lmk if you want to join', 'send me a pic when you arrive lol', 'planning trip — any tips?',
  'totally, lets do it', 'maybe next week?', 'haha yes', 'omg the playlist',
  'on my way', 'reschedule? something came up', 'see you soon', 'thanks for the rec',
];

export const BIO_FRAGMENTS = [
  'into long walks and short flights.',
  'always down for coffee. or tea. or anything caffeinated.',
  'currently somewhere between cities.',
  'I make playlists for fun.',
  'will travel for food.',
  'midwest at heart.',
  'engineer by day, DJ by night.',
  'half-marathon runner, full-time over-thinker.',
  'looking for plans that don\'t involve another rooftop bar.',
  'professional taking-photos-of-food haver.',
  'always one trip behind on planning.',
  'love a good market. and a worse bar.',
  'born here, but most of my friends aren\'t.',
  'new in town, looking for the good spots.',
  'will absolutely show up to your weird hobby thing.',
];

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickMany<T>(arr: readonly T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Add small jitter to lat/lng so users in the same city aren't stacked on one pin.
// ~0.03 ≈ 3km, ~0.15 ≈ 15km. Variation gives a realistic city spread.
export function jitter(coord: number, range = 0.08): number {
  return coord + (Math.random() - 0.5) * range * 2;
}

export function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
