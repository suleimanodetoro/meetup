/**
 * Seed local Supabase with 25 personas + a realistic social graph.
 *
 * Strategy:
 *  1. Create auth users (the `handle_new_user` trigger auto-creates a profile).
 *  2. Update each profile with the full onboarding payload.
 *  3. Build friendship clusters by city (real social graphs cluster geographically).
 *  4. Generate visits, events, and attendance.
 *     The `create_event_conversation` trigger auto-creates a group conversation
 *     per event; `add_user_to_event_conversation` auto-adds attendees. We only
 *     backfill messages.
 *  5. Create DM conversations between friend pairs + a long-message sentinel.
 *  6. Drop in a pro-tier sentinel and a sparse-profile sentinel.
 *
 * Idempotency: run `npm run seed:reset` first if re-seeding.
 */

import { faker } from '@faker-js/faker';
import { admin, SEED_EMAIL_DOMAIN, SEED_PASSWORD } from './env';
import {
  CITIES,
  INTEREST_IDS,
  LANGUAGE_CODES,
  GENDERS,
  GENDER_PREFS,
  MEETING_PREFS,
  EVENT_TEMPLATES,
  MESSAGE_OPENERS,
  BIO_FRAGMENTS,
  pick,
  pickMany,
  jitter,
  daysFromNow,
  type City,
} from './data';

const USER_COUNT = 25;
const EVENT_COUNT = 30;

type Persona = {
  id: string;
  email: string;
  name: string;
  username: string;
  city: City;
  gender: (typeof GENDERS)[number];
};

// ────────────────────────────────────────────────────────────────────────────
// Personas
// ────────────────────────────────────────────────────────────────────────────

async function createPersona(idx: number, city: City): Promise<Persona> {
  const gender = pick(GENDERS);
  const fakerSex = gender === 'other' ? undefined : (gender as 'male' | 'female');
  const firstName = faker.person.firstName(fakerSex);
  const lastName = faker.person.lastName();
  const username = `${firstName}_${lastName}_${idx}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const email = `${username}${SEED_EMAIL_DOMAIN}`;
  const fullName = `${firstName} ${lastName}`;
  const avatarUrl = `https://api.dicebear.com/9.x/lorelei/png?seed=${username}`;

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, avatar_url: avatarUrl },
  });
  if (authError) throw new Error(`createUser ${email}: ${authError.message}`);
  const userId = created.user!.id;

  const bio = pickMany(BIO_FRAGMENTS, 1, 2).join(' ');
  const birthYear = 2026 - faker.number.int({ min: 22, max: 42 });
  const birthDate = `${birthYear}-${String(faker.number.int({ min: 1, max: 12 })).padStart(2, '0')}-${String(faker.number.int({ min: 1, max: 28 })).padStart(2, '0')}`;

  const profileUpdate = {
    full_name: fullName,
    username,
    bio,
    avatar_url: avatarUrl,
    birth_date: birthDate,
    gender,
    gender_preference: pick(GENDER_PREFS),
    meeting_preference: pick(MEETING_PREFS),
    interests: pickMany(INTEREST_IDS, 3, 5),
    languages: pickMany(LANGUAGE_CODES, 1, 3),
    nationality: city.country,
    nationality_code: city.countryCode,
    location: city.name,
    location_country: city.country,
    location_country_code: city.countryCode,
    location_updated_at: new Date().toISOString(),
    onboarding_completed: true,
    onboarding_step: 13,
    updated_at: new Date().toISOString(),
  };

  const { error: updError } = await admin.from('profiles').update(profileUpdate).eq('id', userId);
  if (updError) throw new Error(`profile update ${email}: ${updError.message}`);

  return { id: userId, email, name: fullName, username, city, gender };
}

// ────────────────────────────────────────────────────────────────────────────
// Friendship graph
// ────────────────────────────────────────────────────────────────────────────

async function buildFriendships(personas: Persona[]) {
  // Group by city. Within each city, every persona is friends with 2-4 others
  // in their city + 0-2 cross-city friends. Status = 'accepted' for most.
  const byCity = new Map<string, Persona[]>();
  for (const p of personas) {
    if (!byCity.has(p.city.name)) byCity.set(p.city.name, []);
    byCity.get(p.city.name)!.push(p);
  }

  const edges = new Set<string>();
  const rows: any[] = [];

  const addEdge = (a: Persona, b: Persona, status: 'accepted' | 'pending') => {
    if (a.id === b.id) return;
    const key = [a.id, b.id].sort().join('|');
    if (edges.has(key)) return;
    edges.add(key);
    rows.push({
      requester_id: a.id,
      addressee_id: b.id,
      status,
      created_at: faker.date.recent({ days: 90 }).toISOString(),
    });
  };

  for (const cityPersonas of byCity.values()) {
    for (const p of cityPersonas) {
      const others = cityPersonas.filter((o) => o.id !== p.id);
      const friendsInCity = pickMany(others, 2, Math.min(4, others.length));
      for (const f of friendsInCity) addEdge(p, f, 'accepted');
    }
  }

  // Cross-city: each persona gets 0-1 friend from another city.
  for (const p of personas) {
    if (Math.random() < 0.5) {
      const otherCity = pick(CITIES.filter((c) => c.name !== p.city.name));
      const candidate = personas.find((o) => o.city.name === otherCity.name);
      if (candidate) addEdge(p, candidate, 'accepted');
    }
  }

  // A handful of pending requests so the inbox isn't empty.
  for (let i = 0; i < 4; i++) {
    const a = pick(personas);
    const b = pick(personas.filter((p) => p.id !== a.id));
    addEdge(a, b, 'pending');
  }

  const { error } = await admin.from('friendships').insert(rows);
  if (error) throw new Error(`friendships insert: ${error.message}`);
  console.log(`  → ${rows.length} friendship edges (${rows.filter((r) => r.status === 'pending').length} pending)`);
}

// ────────────────────────────────────────────────────────────────────────────
// Visits — power-law distribution so some cities are "hot"
// ────────────────────────────────────────────────────────────────────────────

async function createVisits(personas: Persona[]) {
  const rows: any[] = [];
  // Two "hot" cities draw most visits; the rest are background noise.
  const hotCities = pickMany(CITIES, 2, 2);

  for (const p of personas) {
    const count = faker.number.int({ min: 0, max: 4 });
    for (let i = 0; i < count; i++) {
      const visitCity =
        Math.random() < 0.6 ? pick(hotCities) : pick(CITIES.filter((c) => c.name !== p.city.name));
      const offsetDays = faker.number.int({ min: -90, max: 90 }); // past + future
      const duration = faker.number.int({ min: 2, max: 10 });
      const start = daysFromNow(offsetDays);
      const end = daysFromNow(offsetDays + duration);
      rows.push({
        user_id: p.id,
        city: visitCity.name,
        country: visitCity.country,
        country_code: visitCity.countryCode,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        created_at: faker.date.recent({ days: 60 }).toISOString(),
      });
    }
  }

  const { error } = await admin.from('visits').insert(rows);
  if (error) throw new Error(`visits insert: ${error.message}`);
  console.log(`  → ${rows.length} visits`);
}

// ────────────────────────────────────────────────────────────────────────────
// Events + attendance
// ────────────────────────────────────────────────────────────────────────────

async function createEvents(personas: Persona[]): Promise<number[]> {
  const eventIds: number[] = [];

  for (let i = 0; i < EVENT_COUNT; i++) {
    const creator = pick(personas);
    const template = pick(EVENT_TEMPLATES);
    const city = creator.city;
    const lng = jitter(city.lng, 0.05);
    const lat = jitter(city.lat, 0.05);
    const daysOut = faker.number.int({ min: -7, max: 30 });
    const eventDate = daysFromNow(daysOut);
    eventDate.setHours(faker.number.int({ min: 18, max: 22 }), 0, 0, 0);

    const { data, error } = await admin
      .from('events')
      .insert({
        title: template.title,
        description: template.desc,
        date: eventDate.toISOString(),
        user_id: creator.id,
        image_uri: `https://api.dicebear.com/9.x/shapes/png?seed=${template.interest}-${i}`,
        city: city.name,
        country: city.country,
        country_code: city.countryCode,
        location_point: `POINT(${lng} ${lat})`,
      })
      .select('id')
      .single();

    if (error) throw new Error(`event insert (${template.title}): ${error.message}`);
    eventIds.push(data.id);

    // Attendance: creator auto-attends, plus 1-8 others (mostly from same city).
    const candidates = personas.filter((p) => p.id !== creator.id);
    const sameCity = candidates.filter((p) => p.city.name === city.name);
    const otherCity = candidates.filter((p) => p.city.name !== city.name);
    const attendees = [
      ...pickMany(sameCity, 1, Math.min(5, sameCity.length)),
      ...pickMany(otherCity, 0, 2),
    ];

    const attendanceRows = [
      { event_id: data.id, user_id: creator.id, created_at: eventDate.toISOString() },
      ...attendees.map((a) => ({
        event_id: data.id,
        user_id: a.id,
        created_at: faker.date.recent({ days: 14 }).toISOString(),
      })),
    ];
    const { error: attErr } = await admin.from('attendance').insert(attendanceRows);
    if (attErr) throw new Error(`attendance for event ${data.id}: ${attErr.message}`);
  }

  console.log(`  → ${eventIds.length} events with attendance`);
  return eventIds;
}

// ────────────────────────────────────────────────────────────────────────────
// Group chat backfill — events already created conversations via trigger
// ────────────────────────────────────────────────────────────────────────────

async function backfillGroupChats(eventIds: number[]) {
  let messageCount = 0;
  for (const eventId of eventIds) {
    const { data: conv } = await admin
      .from('conversations')
      .select('id')
      .eq('event_id', eventId)
      .single();
    if (!conv) continue;

    const { data: participants } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conv.id);
    if (!participants || participants.length === 0) continue;

    // 30% of events have no chatter (realistic — most plans don't generate messages)
    if (Math.random() < 0.3) continue;

    const messageVolume = Math.random() < 0.8 ? faker.number.int({ min: 2, max: 8 })
                                              : faker.number.int({ min: 15, max: 40 });
    const rows = [];
    for (let i = 0; i < messageVolume; i++) {
      rows.push({
        conversation_id: conv.id,
        user_id: pick(participants).user_id,
        content: pick(MESSAGE_OPENERS),
        message_type: 'text',
        created_at: faker.date.recent({ days: 14 }).toISOString(),
      });
    }
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const { error } = await admin.from('messages').insert(rows);
    if (error) throw new Error(`group msgs for conv ${conv.id}: ${error.message}`);
    messageCount += rows.length;
  }
  console.log(`  → ${messageCount} group-chat messages backfilled`);
}

// ────────────────────────────────────────────────────────────────────────────
// DMs between friend pairs
// ────────────────────────────────────────────────────────────────────────────

async function createDMs(personas: Persona[]) {
  const { data: friendships } = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted');

  if (!friendships) return;

  let dmCount = 0;
  let msgCount = 0;

  // 40% of friend pairs DM each other.
  for (const f of friendships) {
    if (Math.random() > 0.4) continue;

    const { data: conv, error: convErr } = await admin
      .from('conversations')
      .insert({ type: 'dm', created_at: faker.date.recent({ days: 60 }).toISOString() })
      .select('id')
      .single();
    if (convErr) throw new Error(`dm conv: ${convErr.message}`);

    const { error: partErr } = await admin.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: f.requester_id, joined_at: new Date().toISOString() },
      { conversation_id: conv.id, user_id: f.addressee_id, joined_at: new Date().toISOString() },
    ]);
    if (partErr) throw new Error(`dm participants: ${partErr.message}`);

    const msgs = faker.number.int({ min: 1, max: 12 });
    const rows = [];
    for (let i = 0; i < msgs; i++) {
      rows.push({
        conversation_id: conv.id,
        user_id: Math.random() < 0.5 ? f.requester_id : f.addressee_id,
        content: pick(MESSAGE_OPENERS),
        message_type: 'text',
        created_at: faker.date.recent({ days: 14 }).toISOString(),
      });
    }
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const { error: msgErr } = await admin.from('messages').insert(rows);
    if (msgErr) throw new Error(`dm messages: ${msgErr.message}`);

    dmCount += 1;
    msgCount += msgs;
  }

  console.log(`  → ${dmCount} DM conversations with ${msgCount} messages`);
}

// ────────────────────────────────────────────────────────────────────────────
// Sentinels — edge-case personas that exist to surface bugs
// ────────────────────────────────────────────────────────────────────────────

async function createSentinels(personas: Persona[]) {
  // Sentinel #1: premium-tier user. The row already exists (auto-created on
  // profile insert as 'free'); we just flip it to the paid shape that
  // RevenueCat's webhook would write.
  const premiumUser = personas[0];
  const { error: subErr } = await admin
    .from('user_subscriptions')
    .update({
      subscription_type: 'premium',
      entitlement_id: 'premium',
      provider: 'promotional',
    })
    .eq('user_id', premiumUser.id);
  if (subErr) throw new Error(`premium subscription: ${subErr.message}`);
  console.log(`  → ${premiumUser.name} marked as premium`);

  // Sentinel #2: a high-volume DM thread for scroll-perf testing
  const a = personas[1];
  const b = personas[2];
  const { data: conv } = await admin
    .from('conversations')
    .insert({ type: 'dm', created_at: faker.date.past({ years: 1 }).toISOString() })
    .select('id')
    .single();
  if (conv) {
    await admin.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: a.id, joined_at: faker.date.past({ years: 1 }).toISOString() },
      { conversation_id: conv.id, user_id: b.id, joined_at: faker.date.past({ years: 1 }).toISOString() },
    ]);
    const rows = [];
    for (let i = 0; i < 80; i++) {
      rows.push({
        conversation_id: conv.id,
        user_id: i % 2 === 0 ? a.id : b.id,
        content: pick(MESSAGE_OPENERS),
        message_type: 'text',
        created_at: faker.date.recent({ days: 30 }).toISOString(),
      });
    }
    rows.sort((x, y) => x.created_at.localeCompare(y.created_at));
    await admin.from('messages').insert(rows);
    console.log(`  → 80-msg scroll-perf DM between ${a.name} and ${b.name}`);
  }

  // Sentinel #3: sparse-profile user — clear out optional fields on persona[3]
  const sparse = personas[3];
  await admin
    .from('profiles')
    .update({ bio: null, avatar_url: '', languages: [], interests: [] })
    .eq('id', sparse.id);
  console.log(`  → ${sparse.name} has a sparse profile (no bio, no avatar)`);

  // Sentinel #4: long-bio user
  const verbose = personas[4];
  const longBio = Array.from({ length: 6 }, () => faker.lorem.sentence(15)).join(' ');
  await admin.from('profiles').update({ bio: longBio }).eq('id', verbose.id);
  console.log(`  → ${verbose.name} has a wall-of-text bio`);
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${USER_COUNT} users + ${EVENT_COUNT} events...\n`);

  console.log('1/6  Creating personas');
  const personas: Persona[] = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const city = CITIES[i % CITIES.length];
    const persona = await createPersona(i, city);
    personas.push(persona);
    process.stdout.write(`     ${i + 1}/${USER_COUNT} ${persona.name.padEnd(28)} (${city.name})\n`);
  }

  console.log('\n2/6  Building friendship graph');
  await buildFriendships(personas);

  console.log('\n3/6  Generating visits');
  await createVisits(personas);

  console.log('\n4/6  Creating events + attendance');
  const eventIds = await createEvents(personas);

  console.log('\n5/6  Backfilling group chats + DMs');
  await backfillGroupChats(eventIds);
  await createDMs(personas);

  console.log('\n6/6  Sentinels');
  await createSentinels(personas);

  console.log('\nDone. Log in with any seeded user:');
  console.log(`  Email:    <username>${SEED_EMAIL_DOMAIN}`);
  console.log(`  Password: ${SEED_PASSWORD}`);
  console.log('\nExamples:');
  for (const p of personas.slice(0, 3)) {
    console.log(`  ${p.email}  (${p.city.name})`);
  }
  console.log(`\nPro-tier sentinel: ${personas[0].email}`);
}

main().catch((err) => {
  console.error('\nSEED FAILED:', err.message ?? err);
  process.exit(1);
});
