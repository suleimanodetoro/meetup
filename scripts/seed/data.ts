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

// UK city set for the App Store screenshots. Dundee is the HERO city (the
// owner's home town) and is seeded densest; the other Scottish cities give the
// UK moderate density. country/countryCode use the EXACT strings the discovery
// RPCs compare against — get_users_in_city does a case-sensitive equality on
// profiles.location + profiles.location_country, and London above already uses
// 'United Kingdom' / 'GB', so we match that verbatim. get_city_plans_ranked
// lower-trims city, so casing there is forgiving; we still keep it clean.
export const UK_CITIES: City[] = [
  { name: 'Dundee', country: 'United Kingdom', countryCode: 'GB', lat: 56.462, lng: -2.9707 },
  { name: 'Edinburgh', country: 'United Kingdom', countryCode: 'GB', lat: 55.9533, lng: -3.1883 },
  { name: 'Glasgow', country: 'United Kingdom', countryCode: 'GB', lat: 55.8642, lng: -4.2518 },
  { name: 'St Andrews', country: 'United Kingdom', countryCode: 'GB', lat: 56.3398, lng: -2.7967 },
  { name: 'Aberdeen', country: 'United Kingdom', countryCode: 'GB', lat: 57.1497, lng: -2.0943 },
];

// Dundee — the city every screenshot should look busiest in.
export const HERO_CITY: City = UK_CITIES[0];

// Every city the seed can place a persona/event in.
export const ALL_CITIES: City[] = [...CITIES, ...UK_CITIES];

// Per-city persona targets. Dundee is deliberately the densest; the home map
// caps at 12 people so 18 gives comfortable headroom. The original six cities
// keep ~their prior volume (12 each ≈ the old 75/6 split); the other Scottish
// cities get moderate density. USER_COUNT in seed.ts is the sum of these.
export const CITY_USER_TARGETS: { city: City; count: number }[] = [
  { city: UK_CITIES[0], count: 18 }, // Dundee (hero)
  { city: UK_CITIES[1], count: 8 }, //  Edinburgh
  { city: UK_CITIES[2], count: 7 }, //  Glasgow
  { city: UK_CITIES[3], count: 5 }, //  St Andrews
  { city: UK_CITIES[4], count: 5 }, //  Aberdeen
  ...CITIES.map((c) => ({ city: c, count: 12 })),
];

// Per-city event targets. Dundee gets 20 (all future-dated → top match_score in
// get_city_plans_ranked, so all 12 map pins are live Dundee sidequests). The
// map caps at 12 each, so the surplus is intentional headroom.
export const CITY_EVENT_TARGETS: { city: City; count: number }[] = [
  { city: UK_CITIES[0], count: 20 }, // Dundee (hero)
  { city: UK_CITIES[1], count: 9 }, //  Edinburgh
  { city: UK_CITIES[2], count: 8 }, //  Glasgow
  { city: UK_CITIES[3], count: 5 }, //  St Andrews
  { city: UK_CITIES[4], count: 5 }, //  Aberdeen
  ...CITIES.map((c) => ({ city: c, count: 9 })),
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

// A seeded event is really a "sidequest" — an open quest overloaded onto the
// events table. Beyond the display fields (title/desc/interest/venue) each
// template carries the matchable dimensions that become a quest_tags row:
// vibe[] (free-text flavour words), energy 1-3, social mode, duration, and an
// optional kind override ('crew' for group-only plans). Tone + several titles
// are drawn from the 165-row quest_catalog shipped in migration 20260619.
export type Sidequest = {
  title: string;
  desc: string;
  interest: string; // one of INTEREST_IDS → events.interests jsonb ARRAY
  vibe: string[]; // quest_tags.vibe text[]
  energy: 1 | 2 | 3; // quest_tags.energy_level
  social: 'solo' | 'pair' | 'group' | 'either'; // quest_tags.social_mode
  duration: number; // quest_tags.duration_min
  venue?: string; // events.location_name
  kind?: 'open' | 'crew'; // events.kind (default 'open')
  soloSafe?: boolean; // quest_tags.is_solo_safe (default true)
};

// Generic, city-agnostic sidequests — used for the original six cities.
export const EVENT_TEMPLATES: Sidequest[] = [
  { title: 'Sunset run + smoothie', desc: 'Easy 5K along the water, then we hit the juice bar and pretend we earned it.', interest: 'fitness', vibe: ['active', 'social', 'outdoors'], energy: 3, social: 'group', duration: 60 },
  { title: 'Speciality coffee crawl', desc: 'Three roasters in three hours. Order whatever the barista is proudest of.', interest: 'coffee', vibe: ['cozy', 'social', 'foodie'], energy: 1, social: 'pair', duration: 90 },
  { title: 'Indie film + late ramen', desc: 'An A24 picture, then we argue about the ending over noodles.', interest: 'film', vibe: ['cozy', 'creative', 'social'], energy: 1, social: 'pair', duration: 150 },
  { title: 'Board games café night', desc: 'BYO snacks. Catan, Codenames, Dixit. Trash talk encouraged.', interest: 'boardgames', vibe: ['cozy', 'playful', 'social'], energy: 1, social: 'group', duration: 120 },
  { title: 'Golden-hour photo walk', desc: 'Old town at golden hour, bring whatever camera (phones count).', interest: 'photography', vibe: ['creative', 'outdoors', 'explore'], energy: 2, social: 'pair', duration: 90 },
  { title: 'Saturday hill hike', desc: '12K loop, moderate pace, dog-friendly, café at the end.', interest: 'outdoor', vibe: ['active', 'outdoors', 'scenic'], energy: 3, social: 'group', duration: 180, kind: 'crew' },
  { title: 'Karaoke + late dinner', desc: 'Private booth, two hours, songs are non-negotiable.', interest: 'karaoke', vibe: ['playful', 'social', 'brave'], energy: 2, social: 'group', duration: 120 },
  { title: 'Live music, tiny venue', desc: 'Local band, sticky floor, 40-cap room. The good kind.', interest: 'music', vibe: ['creative', 'social', 'spontaneous'], energy: 2, social: 'group', duration: 120 },
  { title: 'Yoga in the park', desc: 'Mats provided, all levels, coffee after for the non-flexible.', interest: 'yoga', vibe: ['chill', 'outdoors', 'cozy'], energy: 1, social: 'group', duration: 60 },
  { title: 'Tech meetup: build night', desc: 'Two lightning talks, pizza, and someone demoing a thing at 40% done.', interest: 'tech', vibe: ['curious', 'social', 'creative'], energy: 1, social: 'group', duration: 120 },
  { title: 'Brunch + contemporary show', desc: 'Cold pastries then a gallery we pretend to understand.', interest: 'arts', vibe: ['creative', 'cozy', 'social'], energy: 1, social: 'either', duration: 120 },
  { title: 'Pickup five-a-side', desc: 'All levels, friendly, pints for the winners and losers.', interest: 'sports', vibe: ['active', 'social', 'playful'], energy: 3, social: 'group', duration: 90, kind: 'crew' },
  { title: 'Park cleanup + coffee', desc: 'Two hours, gloves provided, smugness guaranteed.', interest: 'volunteer', vibe: ['kind', 'outdoors', 'social'], energy: 2, social: 'group', duration: 120 },
  { title: 'Book club: this month\'s pick', desc: 'We meet, we argue about a novel, someone hasn\'t finished it.', interest: 'bookclub', vibe: ['cozy', 'curious', 'social'], energy: 1, social: 'group', duration: 90 },
  { title: 'Skate session, beginners in', desc: 'Bowl + flat ground, beginners genuinely welcome.', interest: 'skate', vibe: ['active', 'brave', 'social'], energy: 3, social: 'group', duration: 90 },
  { title: 'Warehouse rave warmup', desc: 'Drinks and a playlist before the 11pm set.', interest: 'raves', vibe: ['spontaneous', 'playful', 'social'], energy: 2, social: 'group', duration: 90 },
];

// ── Dundee: the hero city. Bespoke, believable, locally-anchored sidequests. ──
export const DUNDEE_SIDEQUESTS: Sidequest[] = [
  { title: 'Sunrise dip at Broughty Ferry', desc: 'Meet at the beach for a proper cold-water sea dip as the sun comes up. Flask of something hot for after.', interest: 'fitness', vibe: ['brave', 'adventurous', 'outdoors', 'scenic'], energy: 3, social: 'group', duration: 60, venue: 'Broughty Ferry beach', kind: 'crew', soloSafe: false },
  { title: 'Dundee Law at golden hour', desc: 'Short sharp climb up the Law for the best free view in the city, timed for sunset over the Tay.', interest: 'outdoor', vibe: ['scenic', 'outdoors', 'active', 'chill'], energy: 2, social: 'group', duration: 90, venue: 'Dundee Law' },
  { title: 'V&A design-sketch hour', desc: 'Grab a sketchbook, find a corner of the V&A, and draw badly for an hour. No skill required, just vibes.', interest: 'arts', vibe: ['creative', 'cozy', 'curious'], energy: 1, social: 'either', duration: 60, venue: 'V&A Dundee' },
  { title: 'Westport record-shop crawl', desc: 'Dig through the crates at Groucho\'s and the Westport shops. Everyone leaves with one record they didn\'t plan to buy.', interest: 'music', vibe: ['creative', 'explore', 'nostalgic', 'social'], energy: 2, social: 'pair', duration: 90, venue: 'Westport' },
  { title: 'Bouldering intro at Avertical World', desc: 'First-timers welcome. Two hours of falling onto crash mats and calling it exercise.', interest: 'fitness', vibe: ['active', 'brave', 'social'], energy: 3, social: 'group', duration: 90, venue: 'Avertical World', kind: 'crew' },
  { title: 'Board-game café night', desc: 'Catan, Codenames and a bottomless pot of tea. Rivalries will be formed.', interest: 'boardgames', vibe: ['cozy', 'playful', 'social', 'chill'], energy: 1, social: 'group', duration: 120 },
  { title: 'Street-photography walk along the Tay', desc: 'Waterfront to the rail bridge, chasing reflections and light. Bring any camera, phones fully count.', interest: 'photography', vibe: ['creative', 'outdoors', 'scenic', 'explore'], energy: 2, social: 'pair', duration: 90, venue: 'Riverside / Tay waterfront' },
  { title: 'Zine swap on Perth Road', desc: 'Bring a zine, take a zine. Cheap coffee, weird staples, new friends.', interest: 'creative', vibe: ['creative', 'cozy', 'nostalgic', 'social'], energy: 1, social: 'group', duration: 90, venue: 'Perth Road' },
  { title: 'Thursday pub quiz crew', desc: 'We need a fourth (and a fifth). Strong on 90s music, catastrophic on sport.', interest: 'partying', vibe: ['social', 'playful', 'cozy'], energy: 2, social: 'group', duration: 120, kind: 'crew' },
  { title: 'Late-night bakery run', desc: 'Fisher & Donaldson after dark for a fudge doughnut. This is the whole plan and it is a good one.', interest: 'foodie', vibe: ['spontaneous', 'cozy', 'foodie', 'warm'], energy: 1, social: 'pair', duration: 45, venue: 'Fisher & Donaldson' },
  { title: 'DCA show + flat white', desc: 'Whatever\'s on at Dundee Contemporary Arts, then coffee in the café to decode it.', interest: 'arts', vibe: ['creative', 'cozy', 'social', 'curious'], energy: 1, social: 'either', duration: 90, venue: 'DCA' },
  { title: 'Magdalen Green bandstand picnic', desc: 'Blanket, snacks, and Scotland\'s oldest bandstand. Golden hour over the bridge if we time it right.', interest: 'outdoor', vibe: ['chill', 'cozy', 'scenic', 'social'], energy: 1, social: 'group', duration: 120, venue: 'Magdalen Green' },
  { title: 'Bridge walk to Newport brunch', desc: 'Walk the Tay road bridge across to Newport, earn an enormous brunch, get the bus back.', interest: 'foodie', vibe: ['active', 'scenic', 'outdoors', 'foodie'], energy: 2, social: 'pair', duration: 120 },
  { title: 'Riverside skate session', desc: 'Flat ground and mellow ledges by the water. Beginners genuinely welcome.', interest: 'skate', vibe: ['active', 'social', 'outdoors', 'brave'], energy: 3, social: 'group', duration: 90, venue: 'Riverside' },
  { title: 'Vintage crawl at the Keiller Centre', desc: 'Rummage the indie units and charity shops for the perfect ugly jumper. Prize for best find.', interest: 'fashion', vibe: ['explore', 'nostalgic', 'creative', 'social'], energy: 1, social: 'pair', duration: 90, venue: 'Keiller Centre' },
  { title: 'Life-drawing evening', desc: 'Relaxed, all abilities, wine optional. Come make some gloriously wonky art.', interest: 'arts', vibe: ['creative', 'brave', 'cozy'], energy: 1, social: 'group', duration: 120 },
  { title: 'Camperdown Park bike loop', desc: 'Easy woodland loop, café stop halfway, wildlife centre if anyone\'s feeling it.', interest: 'outdoor', vibe: ['active', 'outdoors', 'scenic', 'chill'], energy: 2, social: 'group', duration: 90, venue: 'Camperdown Park' },
  { title: 'Open-mic night on Perth Road', desc: 'Songs, poems, terrible jokes. Sign up or just heckle supportively from the back.', interest: 'music', vibe: ['creative', 'social', 'brave', 'cozy'], energy: 2, social: 'group', duration: 120, venue: 'Perth Road' },
  { title: 'Discovery Point sunset stroll', desc: 'Slow waterfront wander past the RRS Discovery and the V&A as the light goes pink.', interest: 'outdoor', vibe: ['scenic', 'cozy', 'nostalgic', 'chill'], energy: 1, social: 'pair', duration: 60, venue: 'Discovery Point' },
  { title: 'Sketch-crawl of the Howff', desc: 'Draw the wonky headstones of Dundee\'s ancient graveyard. Weirdly peaceful, secretly gothic.', interest: 'creative', vibe: ['creative', 'nostalgic', 'curious', 'cozy'], energy: 1, social: 'pair', duration: 90, venue: 'The Howff' },
  { title: 'Vinyl & natural-wine night', desc: 'Everyone brings two records and a bottle. We DJ badly and love every minute.', interest: 'music', vibe: ['cozy', 'social', 'creative', 'chill'], energy: 1, social: 'group', duration: 150 },
  { title: 'Uni-pitches five-a-side', desc: 'Casual kickabout, all levels, jumpers-for-goalposts energy. Winners buy the chips.', interest: 'sports', vibe: ['active', 'social', 'playful'], energy: 3, social: 'group', duration: 90, kind: 'crew' },
];

// ── Other UK cities: city-agnostic Scottish/UK sidequests. ──
export const UK_SIDEQUESTS: Sidequest[] = [
  { title: 'Thursday pub quiz', desc: 'Team needs bodies. We\'re strong on music, weak on everything else.', interest: 'partying', vibe: ['social', 'playful', 'cozy'], energy: 2, social: 'group', duration: 120, kind: 'crew' },
  { title: 'Speciality coffee crawl', desc: 'Three roasters, one morning. Order whatever they\'re proudest of.', interest: 'coffee', vibe: ['cozy', 'social', 'foodie'], energy: 1, social: 'pair', duration: 90 },
  { title: 'Charity-shop vintage hunt', desc: 'Rummage the high-street charity shops for the perfect ugly jumper. Prize for best find.', interest: 'fashion', vibe: ['explore', 'nostalgic', 'creative', 'social'], energy: 1, social: 'pair', duration: 90 },
  { title: 'Saturday parkrun', desc: 'Free, timed, 5K, everyone welcome from sprinters to strollers. Coffee after.', interest: 'fitness', vibe: ['active', 'outdoors', 'social'], energy: 3, social: 'group', duration: 45 },
  { title: 'Board-game café afternoon', desc: 'Bottomless tea and a shelf of games. Gentle rivalries encouraged.', interest: 'boardgames', vibe: ['cozy', 'social', 'playful'], energy: 1, social: 'group', duration: 120 },
  { title: 'Bouldering taster', desc: 'First-timers welcome, shoes included. Falling onto mats, calling it exercise.', interest: 'fitness', vibe: ['active', 'brave', 'social'], energy: 3, social: 'group', duration: 90, kind: 'crew' },
  { title: 'Record-shop crawl', desc: 'Dig the crates in the indie shops. Everyone leaves with one unplanned record.', interest: 'music', vibe: ['creative', 'explore', 'nostalgic'], energy: 2, social: 'pair', duration: 90 },
  { title: 'Life-drawing evening', desc: 'Relaxed, all abilities, wine optional. Wonky art guaranteed.', interest: 'arts', vibe: ['creative', 'brave', 'cozy'], energy: 1, social: 'group', duration: 120 },
  { title: 'Street-photography walk', desc: 'Old town at golden hour, chasing light and reflections. Any camera counts.', interest: 'photography', vibe: ['creative', 'outdoors', 'explore', 'scenic'], energy: 2, social: 'pair', duration: 90 },
  { title: 'Open-mic night', desc: 'Songs, poems, terrible jokes. Perform or heckle supportively from the back.', interest: 'music', vibe: ['creative', 'social', 'brave'], energy: 2, social: 'group', duration: 120 },
  { title: 'Natural-wine & vinyl night', desc: 'Bring two records and a bottle. We DJ badly and love it.', interest: 'music', vibe: ['cozy', 'social', 'creative', 'chill'], energy: 1, social: 'group', duration: 150 },
  { title: 'Sunday roast + long walk', desc: 'Big walk to earn it, then an enormous roast. The correct order of operations.', interest: 'foodie', vibe: ['cozy', 'social', 'outdoors', 'chill'], energy: 1, social: 'group', duration: 180 },
  { title: 'Late-night bakery run', desc: 'Best doughnut in town, after dark. This is the whole plan and it rules.', interest: 'foodie', vibe: ['spontaneous', 'cozy', 'foodie', 'warm'], energy: 1, social: 'pair', duration: 45 },
  { title: 'Ceilidh night', desc: 'No experience needed, the caller shouts the moves, chaos ensues. Bring water.', interest: 'dance', vibe: ['social', 'playful', 'active'], energy: 3, social: 'group', duration: 150, kind: 'crew' },
  { title: 'Botanic gardens photo loop', desc: 'Slow wander through the glasshouses and beds, cameras out, café at the end.', interest: 'photography', vibe: ['scenic', 'chill', 'outdoors', 'creative'], energy: 1, social: 'pair', duration: 60 },
];

// A few landmark-anchored sidequests per non-hero UK city, mixed in ahead of the
// generic UK pool so each Scottish city reads locally believable.
export const LANDMARK_SIDEQUESTS: Record<string, Sidequest[]> = {
  Edinburgh: [
    { title: "Arthur's Seat sunrise hike", desc: 'Up before dawn for the extinct volcano and the whole city laid out below. Coffee earned.', interest: 'outdoor', vibe: ['scenic', 'outdoors', 'active', 'brave'], energy: 3, social: 'group', duration: 90, venue: "Arthur's Seat", kind: 'crew' },
    { title: 'Dean Village photo loop', desc: 'The Water of Leith walkway and the storybook cottages. Absurdly photogenic.', interest: 'photography', vibe: ['scenic', 'creative', 'outdoors', 'explore'], energy: 2, social: 'pair', duration: 90, venue: 'Dean Village' },
    { title: 'Stockbridge Sunday market crawl', desc: 'Street food, vintage stalls and the best people-watching in town.', interest: 'foodie', vibe: ['social', 'foodie', 'explore', 'cozy'], energy: 1, social: 'group', duration: 120, venue: 'Stockbridge Market' },
  ],
  Glasgow: [
    { title: 'Kelvingrove gallery hour', desc: 'Organ recital at 1pm, Dalí upstairs, and one of the best free museums anywhere.', interest: 'arts', vibe: ['creative', 'cozy', 'curious', 'social'], energy: 1, social: 'either', duration: 90, venue: 'Kelvingrove' },
    { title: 'Barras market vintage crawl', desc: 'The East End weekend market for records, leather and gloriously random finds.', interest: 'fashion', vibe: ['explore', 'nostalgic', 'social', 'creative'], energy: 1, social: 'pair', duration: 120, venue: 'The Barras' },
    { title: 'Southside vinyl hunt', desc: 'Victoria Road record shops then a flat white. Everyone leaves with something.', interest: 'music', vibe: ['creative', 'explore', 'nostalgic', 'social'], energy: 2, social: 'pair', duration: 90, venue: 'Victoria Road' },
    { title: 'Necropolis golden-hour walk', desc: 'Victorian city of the dead on the hill, best light in the evening, secretly gorgeous.', interest: 'outdoor', vibe: ['scenic', 'nostalgic', 'curious', 'outdoors'], energy: 2, social: 'pair', duration: 60, venue: 'Glasgow Necropolis' },
  ],
  'St Andrews': [
    { title: 'West Sands beach walk', desc: 'The Chariots of Fire beach. Run it dramatically if you must. Ice cream after.', interest: 'outdoor', vibe: ['scenic', 'outdoors', 'active', 'playful'], energy: 2, social: 'group', duration: 90, venue: 'West Sands' },
    { title: 'Old Course sunset stroll', desc: 'Walk the 18th and the Swilcan Bridge at dusk, no clubs required.', interest: 'outdoor', vibe: ['scenic', 'cozy', 'nostalgic', 'chill'], energy: 1, social: 'pair', duration: 60, venue: 'The Old Course' },
    { title: 'East Sands sea dip', desc: 'Quick, bracing cold-water dip with the harbour view. Flask essential.', interest: 'fitness', vibe: ['brave', 'adventurous', 'outdoors', 'social'], energy: 3, social: 'group', duration: 60, venue: 'East Sands', kind: 'crew', soloSafe: false },
  ],
  Aberdeen: [
    { title: 'Footdee (Fittie) wander', desc: 'The tiny quirky fishing village at the harbour mouth. Every doorway is a photo.', interest: 'photography', vibe: ['explore', 'nostalgic', 'scenic', 'creative'], energy: 1, social: 'pair', duration: 60, venue: 'Footdee' },
    { title: 'Granite City architecture walk', desc: 'Chase the way the mica in the granite sparkles when the sun finally shows up.', interest: 'photography', vibe: ['creative', 'outdoors', 'explore', 'curious'], energy: 2, social: 'pair', duration: 90 },
    { title: 'Torry Battery dolphin watch', desc: 'Bottlenose dolphins at the harbour mouth, best on a rising tide. Bring binoculars.', interest: 'outdoor', vibe: ['scenic', 'outdoors', 'curious', 'chill'], energy: 1, social: 'group', duration: 90, venue: 'Torry Battery' },
  ],
};

// Which sidequest pool to draw from for a given city.
export function sidequestsForCity(city: City): Sidequest[] {
  if (city.name === HERO_CITY.name) return DUNDEE_SIDEQUESTS;
  const landmarks = LANDMARK_SIDEQUESTS[city.name];
  if (landmarks) return [...landmarks, ...UK_SIDEQUESTS];
  return EVENT_TEMPLATES;
}

export const MESSAGE_OPENERS = [
  'hey!', 'nice to match', 'how was your week?', 'are you around this weekend?',
  'thought of you when I saw this', 'have you been before?', 'one of my favourites',
  'lmk if you want to join', 'send me a pic when you arrive lol', 'planning trip — any tips?',
  'totally, lets do it', 'maybe next week?', 'haha yes', 'omg the playlist',
  'on my way', 'reschedule? something came up', 'see you soon', 'thanks for the rec',
];

// Slightly richer, plan-oriented lines used for the owner's DM threads so their
// Chats screen reads like a real, Dundee-alive inbox for screenshots.
export const CHAT_LINES = [
  'hey! are you about this weekend?',
  'that Broughty Ferry dip is still on for Saturday if you fancy it',
  'omg the record shop had the exact pressing I wanted',
  'pub quiz on thursday — we need a fourth, you in?',
  'coffee before the V&A thing?',
  'running 5 mins late, grab us a table?',
  'that was such a good one, same time next week?',
  'sending you the playlist now',
  'did you make it up the Law for sunset?',
  'fisher & donaldson run? I can\'t stop thinking about the doughnut',
  'lmk if you want to carpool',
  'perfect, see you at 7',
  'haha yes absolutely',
  'the light on the Tay right now is unreal',
  'good shout, adding it to the plan',
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

// Curated Pexels stock photos used for event/plan covers. Picked to read like
// real meetup/travel content rather than the abstract DiceBear shapes the old
// seed used. Pexels URLs stay stable long-term, so they're safe to bake in.
// Every id below was HTTP-200 verified (2026-07); the one dead entry from the
// original pool (2747508) was dropped. Pool is intentionally wide (40 covers)
// so the 12 visible Dundee pins rarely repeat an image.
export const EVENT_IMAGES = [
  'https://images.pexels.com/photos/2167673/pexels-photo-2167673.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1267697/pexels-photo-1267697.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2014773/pexels-photo-2014773.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1647962/pexels-photo-1647962.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2422915/pexels-photo-2422915.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1851415/pexels-photo-1851415.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/904616/pexels-photo-904616.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1812964/pexels-photo-1812964.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1407322/pexels-photo-1407322.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1153370/pexels-photo-1153370.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/848618/pexels-photo-848618.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1230302/pexels-photo-1230302.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1687845/pexels-photo-1687845.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2280571/pexels-photo-2280571.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1616403/pexels-photo-1616403.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1234035/pexels-photo-1234035.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2091166/pexels-photo-2091166.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1699030/pexels-photo-1699030.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3771836/pexels-photo-3771836.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1656066/pexels-photo-1656066.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/208745/pexels-photo-208745.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/358457/pexels-photo-358457.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/2549018/pexels-photo-2549018.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/210012/pexels-photo-210012.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/274131/pexels-photo-274131.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1687678/pexels-photo-1687678.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1105391/pexels-photo-1105391.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/3184423/pexels-photo-3184423.jpeg?auto=compress&cs=tinysrgb&w=800',
];

/**
 * Curated Unsplash portrait pools for seeded personas. These replace the old
 * randomuser.me thumbnails, which were 128x128, skewed visibly older, and served
 * LEGO figurines for the 'other' bucket. Each URL is an Unsplash CDN direct link
 * requested at 400x400 (fit=crop&crop=faces so the face stays centred at every
 * render size — 42px map pins, 64px cards, large profile headers), q=80.
 *
 * Sourcing: harvested from Unsplash's public people/portrait search results, one
 * pool per presentation, drawing across ethnicities for a diverse cast. Every URL
 * below was HTTP-verified (200 + content-type image/* + a decode check that the
 * returned image is 400x400, not a redirect/HTML page) at build time, and each
 * entry is a distinct photoshoot (same-session uploads collapsed to one) so no
 * single model appears twice. Subject age/skew is best-effort: it cannot be
 * verified programmatically, so the pools are curated from portrait queries.
 *
 * No-dupe-per-city guarantee: seed.ts assigns personas to cities in CONTIGUOUS
 * global-idx blocks (Dundee 0-17, then each other city in turn), max 18 per city.
 * getAvatarUrl indexes each pool by `idx % pool.length`; since every pool has far
 * more than 18 entries, any run of <=18 consecutive idx maps to distinct URLs, so
 * no two personas in the same city ever share a portrait. (Collisions across
 * different cities are possible but harmless — you only ever see one city's map.)
 */
const FEMININE_PORTRAITS: string[] = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1632765854612-9b02b6ec2b15?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1589525231707-f2de2428f59c?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1644718847151-fff2271484a1?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1533128361669-69c065857a13?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1589156191108-c762ff4b96ab?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1513097633097-329a3a64e0d4?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1523761415282-2106778cfb5a?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1463335361701-e90f4c5045d0?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1549317079-75d70028e3a5?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1496813146940-1601b02f81a4?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1557296387-5358ad7997bb?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1600481176431-47ad2ab2745d?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1598292254404-da6a31f7fa75?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1580746453801-37b0bc56f3b4?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1636406269177-4827c00bb263?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1539701938214-0d9736e1c16b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1589553009868-c7b2bb474531?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1651534400411-eaf227f82ee4?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1725611224180-4a50ef13a0e8?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1520529277867-dbf8c5e0b340?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1527203561188-dae1bc1a417f?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1521227889351-bf6f5b2e4e37?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1679507655428-ab3d50356bac?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1759840278381-bf7d5e332050?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1633355130553-2d90ad3507d3?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1593351799227-75df2026356b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1624091844772-554661d10173?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1644044671706-95314b2bbb9a?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1774437890454-634d48db52c8?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1728463087277-97c8d8c7b6a4?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1512361436605-a484bdb34b5f?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1616639943825-e0fbad20a3d3?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1559405201-8f58c61e7dde?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1767607740661-05e668190cdc?w=400&h=400&fit=crop&crop=faces&q=80',
];

const MASCULINE_PORTRAITS: string[] = [
  'https://images.unsplash.com/photo-1587397845856-e6cf49176c70?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1544168190-79c17527004f?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1596075780750-81249df16d19?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1583336191538-a1beaefd3ad4?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1545996124-0501ebae84d0?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1570158268183-d296b2892211?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1624395213043-fa2e123b2656?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1669277752825-d7c26a392b4d?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1762066436595-67edb4610539?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1541112324160-e8a425b58dac?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1565884280295-98eb83e41c65?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1695737679868-de7eb09df3d0?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1604346382498-34e8c19df705?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1711464669343-2596d0f1b526?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1518882570151-157128e78fa1?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1681097561932-36d0df02b379?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1700652793469-6fcbffc9aed6?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1771766691105-455a273c6ca6?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1724225618359-a1d2763326f9?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1587064712555-6e206484699b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1718986017030-b6ba6f96827b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1535643302794-19c3804b874b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1766334079470-7f36e9c78311?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1558730234-d8b2281b0d00?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1531901599143-df5010ab9438?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1643990083741-c5a4d4ae69e2?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1652883254451-a7c2b94cc35b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1782036257628-e5e058579815?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1584984647264-7e6f4e6d6b91?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1605980776566-0486c3ac7617?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1622626426572-c268eb006092?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1713152718429-30e27fa08cf3?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1782170609022-e3ccb7ecb62a?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1591973669966-52d2534d9087?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1584119164246-461d43e9bab3?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1617355453845-6996ffeee4de?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1648757766966-43d24bf7a264?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1779290851733-6d5205b0a611?w=400&h=400&fit=crop&crop=faces&q=80',
];

// Mixed / androgynous pool for the 'other' gender bucket — real portraits (no
// LEGO, no cartoons), leading with the most gender-neutral shots.
const MIXED_PORTRAITS: string[] = [
  'https://images.unsplash.com/photo-1581841064838-a470c740e8ee?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1614204424926-196a80bf0be8?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1601412436009-d964bd02edbc?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1514960919797-5ff58c52e5ba?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1517462964-21fdcec3f25b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1611695434398-4f4b330623e6?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1548544149-4835e62ee5b3?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1504553101389-41a8f048c3ba?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1553867745-6e038d085e86?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1679466061812-211a6b737175?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1590702841774-45166f031529?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1540172777610-b15b605dd68d?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1505840717430-882ce147ef2d?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1532170579297-281918c8ae72?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1553817678-cdec00119116?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1558499932-9609acb6f443?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1584362562886-9b9002d5e493?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1600603406200-5b2a104684ac?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1608734265656-f035d3e7bcbf?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1721956514577-f6c15d73e585?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1518305860742-0d7119d4567f?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1529218164294-0d21b06ea831?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1584014660355-27b0b860256e?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1620952104324-3bef38e34a93?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1636486183541-83634a8dc9a7?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1595887543484-e4a94a97abf1?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1586814648605-a677ea9285a6?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1727469801251-bfefc646551b?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1647593782884-1a6779139eb5?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1557007025-735777a3ac07?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1584541984229-f5150426225e?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1585058825954-2fba50a23b7d?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1520178862152-006e82c6d62d?w=400&h=400&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1783306224041-c395179925e6?w=400&h=400&fit=crop&crop=faces&q=80',
];

/**
 * Return a stable, high-resolution portrait URL for a seeded persona. Same
 * (idx, gender) always yields the same URL. See the no-dupe-per-city note above.
 */
export function getAvatarUrl(idx: number, gender: (typeof GENDERS)[number]): string {
  const pool =
    gender === 'female' ? FEMININE_PORTRAITS : gender === 'male' ? MASCULINE_PORTRAITS : MIXED_PORTRAITS;
  return pool[idx % pool.length];
}

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
