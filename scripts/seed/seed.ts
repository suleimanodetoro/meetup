/**
 * Seed local (or, with the safety latch, remote) Supabase with a dense, hip,
 * believable social graph — tuned to make the app look ALIVE for App Store
 * screenshots, especially in DUNDEE (the hero city).
 *
 * Strategy:
 *  1. Create auth users (the `handle_new_user` trigger auto-creates a profile),
 *     WEIGHTED by CITY_USER_TARGETS so Dundee is busiest (18), the other UK
 *     cities are moderate, and the original six keep ~their prior volume.
 *  2. Update each profile with the full onboarding payload (onboarding_completed,
 *     bio, valid interests taxonomy, languages, diverse names + avatars).
 *  3. Build friendship clusters by city (real social graphs cluster geographically).
 *  4. Generate visits (every persona gets a home-city visit overlapping the next
 *     90 days so city-detail ranking surfaces them), events, and attendance.
 *     Events are seeded as SIDEQUESTS: kind='open' (some 'crew'), status='active',
 *     is_private=false, a quest_tags row (vibe/energy/social_mode/is_seed) each,
 *     and localized titles (Dundee gets bespoke ones). Weighted by
 *     CITY_EVENT_TARGETS so Dundee has 20 future-dated sidequests.
 *     The `create_event_conversation` trigger auto-creates a group conversation
 *     per event; `add_user_to_event_conversation` auto-adds attendees. We only
 *     backfill messages.
 *  5. Create DM conversations between friend pairs + a long-message sentinel.
 *  6. Drop in a pro-tier sentinel and a sparse-profile sentinel (kept OFF Dundee
 *     so the hero city stays pristine in screenshots).
 *  7. OPTIONAL owner hookup: if SEED_OWNER_EMAIL is set and matches a real auth
 *     user, wire that account into the Dundee scene — accepted friendships,
 *     recent DM threads, and a couple of event RSVPs — so the owner's own
 *     Chats/Friends/profile screens look alive. Skipped silently otherwise.
 *
 * Idempotency: RUN `npm run seed:reset` FIRST for a clean slate — it wipes every
 * @seed.local user (cascades remove their content). Because events.user_id is
 * ON DELETE SET NULL, reset leaves hostless seed events behind; this script
 * sweeps those first (step 0, matched precisely via the is_seed quest_tag, so it
 * never touches real plans). Every other insert is additive and skips-on-conflict
 * where a unique constraint exists, so a re-run without reset stacks more data
 * rather than crashing.
 *
 * Owner hookup: set SEED_OWNER_EMAIL=<your login email> to also wire your own
 * (non-seed) account into Dundee. Unset it to skip.
 */

import { faker } from '@faker-js/faker';
import { admin, SEED_EMAIL_DOMAIN, SEED_PASSWORD } from './env';
import {
  CITIES,
  ALL_CITIES,
  HERO_CITY,
  CITY_USER_TARGETS,
  CITY_EVENT_TARGETS,
  INTEREST_IDS,
  LANGUAGE_CODES,
  GENDERS,
  GENDER_PREFS,
  MEETING_PREFS,
  EVENT_IMAGES,
  MESSAGE_OPENERS,
  CHAT_LINES,
  BIO_FRAGMENTS,
  sidequestsForCity,
  getAvatarUrl,
  pick,
  pickMany,
  jitter,
  daysFromNow,
  type City,
} from './data';

const USER_COUNT = CITY_USER_TARGETS.reduce((sum, t) => sum + t.count, 0);
const EVENT_COUNT = CITY_EVENT_TARGETS.reduce((sum, t) => sum + t.count, 0);

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
  const avatarUrl = getAvatarUrl(idx, gender);

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
      const otherCity = pick(ALL_CITIES.filter((c) => c.name !== p.city.name));
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

  const { error } = await admin
    .from('friendships')
    .upsert(rows, { onConflict: 'requester_id,addressee_id', ignoreDuplicates: true });
  if (error) throw new Error(`friendships insert: ${error.message}`);
  console.log(`  → ${rows.length} friendship edges (${rows.filter((r) => r.status === 'pending').length} pending)`);
}

// ────────────────────────────────────────────────────────────────────────────
// Visits — power-law distribution so some cities are "hot"
// ────────────────────────────────────────────────────────────────────────────

async function createVisits(personas: Persona[]) {
  const rows: any[] = [];
  const pushVisit = (userId: string, city: City, startOffset: number, duration: number) => {
    const start = daysFromNow(startOffset);
    const end = daysFromNow(startOffset + duration);
    rows.push({
      user_id: userId,
      city: city.name,
      country: city.country,
      country_code: city.countryCode,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      created_at: faker.date.recent({ days: 60 }).toISOString(),
    });
  };

  // 1) Every persona gets a home-city "presence" visit that overlaps the default
  //    [today, today+90] city window, so get_city_users_ranked scores them 1000
  //    and they surface on their own city's detail page.
  for (const p of personas) {
    pushVisit(p.id, p.city, faker.number.int({ min: -2, max: 14 }), faker.number.int({ min: 3, max: 12 }));
  }

  // 2) Texture: extra trips. Dundee is a guaranteed "hot" destination so the
  //    hero city stays busy even for visitors, not just residents.
  const hotCities = [HERO_CITY, pick(CITIES)];
  for (const p of personas) {
    const count = faker.number.int({ min: 0, max: 3 });
    for (let i = 0; i < count; i++) {
      const visitCity =
        Math.random() < 0.6 ? pick(hotCities) : pick(ALL_CITIES.filter((c) => c.name !== p.city.name));
      const offsetDays = faker.number.int({ min: -90, max: 90 }); // past + future
      pushVisit(p.id, visitCity, offsetDays, faker.number.int({ min: 2, max: 10 }));
    }
  }

  const { error } = await admin.from('visits').insert(rows);
  if (error) throw new Error(`visits insert: ${error.message}`);
  console.log(`  → ${rows.length} visits (incl. one home-city presence visit per user)`);
}

// ────────────────────────────────────────────────────────────────────────────
// Events + attendance
// ────────────────────────────────────────────────────────────────────────────

// Rough opening hour for a sidequest from its title (sunrise dips are dawn,
// quiz/gig/bakery runs are evening, everything else is daytime).
function hourFor(title: string): number {
  const t = title.toLowerCase();
  if (/sunrise|dawn|parkrun|\bdip\b/.test(t)) return faker.number.int({ min: 6, max: 8 });
  if (/sunset|golden hour|night|evening|open-mic|quiz|bakery|vinyl|ceilidh|karaoke|rave|live music/.test(t))
    return faker.number.int({ min: 18, max: 21 });
  return faker.number.int({ min: 10, max: 17 });
}

async function createEvents(
  personas: Persona[]
): Promise<{ eventIds: number[]; dundeeEventIds: number[] }> {
  const eventIds: number[] = [];
  const dundeeEventIds: number[] = [];
  const questTagRows: any[] = [];

  // One shuffled pass over the cover pool with a rolling index → consecutive
  // events (including Dundee's, which are created first) get distinct images.
  const shuffledImages = [...EVENT_IMAGES].sort(() => Math.random() - 0.5);
  let imgIdx = 0;

  const byCity = new Map<string, Persona[]>();
  for (const p of personas) {
    if (!byCity.has(p.city.name)) byCity.set(p.city.name, []);
    byCity.get(p.city.name)!.push(p);
  }

  for (const target of CITY_EVENT_TARGETS) {
    const city = target.city;
    const cityPersonas = byCity.get(city.name) ?? [];
    if (cityPersonas.length === 0) continue; // no host to author a plan there
    const pool = sidequestsForCity(city);
    const isHero = city.name === HERO_CITY.name;

    for (let n = 0; n < target.count; n++) {
      const creator = pick(cityPersonas);
      const template = pick(pool);
      const lng = jitter(city.lng, 0.05);
      const lat = jitter(city.lat, 0.05);

      // Hero city: always future & inside the 90-day window (top match_score, so
      // all 12 map pins are live Dundee sidequests). Others: mostly future, a few
      // just-passed so the city page shows some recent history too.
      const daysOut = isHero
        ? faker.number.int({ min: 1, max: 75 })
        : Math.random() < 0.15
          ? faker.number.int({ min: -6, max: 0 })
          : faker.number.int({ min: 1, max: 75 });
      const eventDate = daysFromNow(daysOut);
      eventDate.setHours(hourFor(template.title), 0, 0, 0);

      const kind = template.kind ?? (Math.random() < 0.18 ? 'crew' : 'open');

      const { data, error } = await admin
        .from('events')
        .insert({
          title: template.title,
          description: template.desc,
          date: eventDate.toISOString(),
          user_id: creator.id,
          image_uri: shuffledImages[imgIdx++ % shuffledImages.length],
          city: city.name,
          country: city.country,
          country_code: city.countryCode,
          location_name: template.venue ?? null,
          location_point: `POINT(${lng} ${lat})`,
          interests: [template.interest],
          is_private: false,
          kind,
          status: 'active',
          comfort: faker.number.int({ min: 1, max: 3 }),
        })
        .select('id')
        .single();

      if (error) throw new Error(`event insert (${template.title}): ${error.message}`);
      eventIds.push(data.id);
      if (isHero) dundeeEventIds.push(data.id);

      // quest_tags: the matchable dimensions that make this row a real sidequest.
      questTagRows.push({
        event_id: data.id,
        vibe: template.vibe,
        energy_level: template.energy,
        social_mode: template.social,
        duration_min: template.duration,
        risk_tier: template.soloSafe === false ? 2 : 1,
        is_solo_safe: template.soloSafe ?? true,
        is_seed: true,
      });

      // Attendance: creator + a power-law crowd (mostly same-city), aiming for
      // ~3-9 going. Small cities backfill from other cities so plans aren't empty.
      const candidates = personas.filter((p) => p.id !== creator.id);
      const sameCity = candidates.filter((p) => p.city.name === city.name);
      const otherCity = candidates.filter((p) => p.city.name !== city.name);
      const extra = Math.random() < 0.75
        ? faker.number.int({ min: 2, max: 5 })
        : faker.number.int({ min: 6, max: 8 });
      const attendees = pickMany(sameCity, Math.min(2, sameCity.length), Math.min(extra, sameCity.length));
      const need = extra - attendees.length;
      if (need > 0) attendees.push(...pickMany(otherCity, need, need));

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
  }

  const { error: qtErr } = await admin
    .from('quest_tags')
    .upsert(questTagRows, { onConflict: 'event_id', ignoreDuplicates: true });
  if (qtErr) throw new Error(`quest_tags insert: ${qtErr.message}`);

  console.log(
    `  → ${eventIds.length} events (${dundeeEventIds.length} in Dundee) with attendance + quest_tags`
  );
  return { eventIds, dundeeEventIds };
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
  // Keep the hero city pristine for screenshots: the premium badge lands on a
  // Dundee persona (a nice touch on the busiest map), but the sparse/verbose/
  // scroll-test sentinels are pulled from OTHER cities so no Dundee pin looks
  // broken or half-empty.
  const premiumUser = personas.find((p) => p.city.name === HERO_CITY.name) ?? personas[0];
  const nonHero = personas.filter((p) => p.city.name !== HERO_CITY.name && p.id !== premiumUser.id);
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
  const a = nonHero[0];
  const b = nonHero[1];
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

  // Sentinel #3: sparse-profile user — clear out optional fields
  const sparse = nonHero[2];
  await admin
    .from('profiles')
    .update({ bio: null, avatar_url: '', languages: [], interests: [] })
    .eq('id', sparse.id);
  console.log(`  → ${sparse.name} has a sparse profile (no bio, no avatar)`);

  // Sentinel #4: long-bio user
  const verbose = nonHero[3];
  const longBio = Array.from({ length: 6 }, () => faker.lorem.sentence(15)).join(' ');
  await admin.from('profiles').update({ bio: longBio }).eq('id', verbose.id);
  console.log(`  → ${verbose.name} has a wall-of-text bio`);
}

// ────────────────────────────────────────────────────────────────────────────
// Optional owner hookup — wire a real account into the Dundee scene
// ────────────────────────────────────────────────────────────────────────────

/** Look up a real (non-seed) auth user by email, case-insensitively. */
async function findAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  // Page through in case the project has many users.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return { id: hit.id, email: hit.email! };
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

/**
 * If SEED_OWNER_EMAIL points at a real auth user, make THEIR account look alive
 * in Dundee: accepted friendships, recent DM threads, and a couple of RSVPs.
 * Skips silently (with a console note) if the var is unset or no user matches.
 */
async function hookupOwner(personas: Persona[], dundeeEventIds: number[]) {
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  if (!ownerEmail) {
    console.log('  → SEED_OWNER_EMAIL not set — skipping owner hookup');
    return;
  }

  const owner = await findAuthUserByEmail(ownerEmail);
  if (!owner) {
    console.log(`  → No auth user matches SEED_OWNER_EMAIL (${ownerEmail}) — skipping owner hookup`);
    return;
  }
  const ownerId = owner.id;

  const dundeePersonas = personas.filter((p) => p.city.name === HERO_CITY.name);
  if (dundeePersonas.length === 0) {
    console.log('  → No Dundee personas to connect the owner to — skipping owner hookup');
    return;
  }

  // Clean up orphan DM shells from a prior seed: a DM whose only other participant
  // was a now-deleted @seed.local user leaves the owner as the sole participant.
  // Deleting those keeps the owner's Chats screen tidy across reset+reseed. Never
  // touches a real 2-person DM.
  const { data: myParts } = await admin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', ownerId);
  const convIds = [...new Set((myParts ?? []).map((r) => r.conversation_id))];
  let cleaned = 0;
  for (const cid of convIds) {
    const { data: convRow } = await admin.from('conversations').select('type').eq('id', cid).single();
    if (convRow?.type !== 'dm') continue;
    const { count } = await admin
      .from('conversation_participants')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', cid);
    if ((count ?? 0) < 2) {
      await admin.from('conversations').delete().eq('id', cid);
      cleaned += 1;
    }
  }
  if (cleaned > 0) console.log(`  → cleaned ${cleaned} orphan owner DM shell(s)`);

  // (a) 4-6 accepted friendships, directions mixed so some are owner-initiated.
  const friendPartners = pickMany(dundeePersonas, 4, Math.min(6, dundeePersonas.length));
  const friendshipRows = friendPartners.map((p, idx) => {
    const ownerRequests = idx % 2 === 0;
    return {
      requester_id: ownerRequests ? ownerId : p.id,
      addressee_id: ownerRequests ? p.id : ownerId,
      status: 'accepted' as const,
      created_at: faker.date.recent({ days: 60 }).toISOString(),
    };
  });
  const { error: fErr } = await admin
    .from('friendships')
    .upsert(friendshipRows, { onConflict: 'requester_id,addressee_id', ignoreDuplicates: true });
  if (fErr) throw new Error(`owner friendships: ${fErr.message}`);

  // (b) 3-5 DM threads with those friends, 2-6 messages each, staggered so the
  //     inbox orders naturally and the newest message is recent + incoming.
  const dmPartners = pickMany(
    friendPartners,
    Math.min(3, friendPartners.length),
    Math.min(5, friendPartners.length)
  );
  const now = Date.now();
  let ownerMsgCount = 0;
  for (let j = 0; j < dmPartners.length; j++) {
    const partner = dmPartners[j];
    const convCreatedAt = new Date(now - (2 + j) * 24 * 3600 * 1000).toISOString();
    const { data: conv, error: convErr } = await admin
      .from('conversations')
      .insert({ type: 'dm', created_at: convCreatedAt })
      .select('id')
      .single();
    if (convErr) throw new Error(`owner dm conv: ${convErr.message}`);

    const { error: partErr } = await admin.from('conversation_participants').upsert(
      [
        { conversation_id: conv.id, user_id: ownerId, joined_at: convCreatedAt },
        { conversation_id: conv.id, user_id: partner.id, joined_at: convCreatedAt },
      ],
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
    );
    if (partErr) throw new Error(`owner dm participants: ${partErr.message}`);

    const m = faker.number.int({ min: 2, max: 6 });
    const rows: any[] = [];
    let tMin = j * 37 + faker.number.int({ min: 5, max: 150 }); // minutes ago for newest msg
    for (let k = 0; k < m; k++) {
      rows.push({
        conversation_id: conv.id,
        // Newest message (k===0) comes FROM the partner so it reads as incoming.
        user_id: k === 0 ? partner.id : Math.random() < 0.5 ? ownerId : partner.id,
        content: pick(CHAT_LINES),
        message_type: 'text',
        created_at: new Date(now - tMin * 60 * 1000).toISOString(),
      });
      tMin += faker.number.int({ min: 20, max: 600 }); // earlier messages further back
    }
    rows.sort((x, y) => x.created_at.localeCompare(y.created_at));
    const { error: msgErr } = await admin.from('messages').insert(rows);
    if (msgErr) throw new Error(`owner dm messages: ${msgErr.message}`);
    ownerMsgCount += rows.length;
  }

  // (c) RSVP the owner into 2-3 Dundee sidequests (the attendance trigger also
  //     drops them into each event's group chat). Skip events they already attend.
  let rsvpCount = 0;
  if (dundeeEventIds.length > 0) {
    const rsvpTargets = pickMany(dundeeEventIds, 2, Math.min(3, dundeeEventIds.length));
    const { data: existing } = await admin
      .from('attendance')
      .select('event_id')
      .eq('user_id', ownerId)
      .in('event_id', rsvpTargets);
    const already = new Set((existing ?? []).map((r) => r.event_id));
    const toAdd = rsvpTargets.filter((id) => !already.has(id));
    if (toAdd.length > 0) {
      const { error: attErr } = await admin.from('attendance').insert(
        toAdd.map((id) => ({
          event_id: id,
          user_id: ownerId,
          created_at: faker.date.recent({ days: 10 }).toISOString(),
        }))
      );
      if (attErr) throw new Error(`owner attendance: ${attErr.message}`);
      rsvpCount = toAdd.length;
    }
  }

  console.log(
    `  → owner ${owner.email}: ${friendshipRows.length} friends, ${dmPartners.length} DMs (${ownerMsgCount} msgs), ${rsvpCount} Dundee RSVPs`
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pre-clean — sweep orphaned seed events that seed:reset can't reach
// ────────────────────────────────────────────────────────────────────────────

/**
 * events.user_id is ON DELETE SET NULL, so when seed:reset deletes the @seed.local
 * hosts their events survive as hostless rows — and a hostless FUTURE event still
 * passes every get_city_plans_ranked filter, so it lingers as a ghost pin on the
 * map. reset.ts's orphan sweep skips NULL user_id, so those never get cleaned.
 *
 * We fix that here (reset can't be edited) precisely and PRODUCTION-SAFELY: only
 * events carrying an is_seed quest_tag AND already hostless are removed. Real
 * user plans never carry is_seed, and the host-null guard means a re-run without
 * reset (seed events still have live seed hosts) leaves live rows alone. Deleting
 * the event cascades its quest_tags, attendance, and auto-created group chat.
 */
async function cleanupOrphanSeedEvents() {
  const { data: seedTags } = await admin.from('quest_tags').select('event_id').eq('is_seed', true);
  const seedEventIds = (seedTags ?? []).map((r) => r.event_id);
  if (seedEventIds.length === 0) {
    console.log('  → no prior seed events to sweep');
    return;
  }
  const { data: deleted, error } = await admin
    .from('events')
    .delete()
    .is('user_id', null)
    .in('id', seedEventIds)
    .select('id');
  if (error) throw new Error(`orphan seed-event sweep: ${error.message}`);
  console.log(`  → swept ${deleted?.length ?? 0} orphaned seed event(s) from a prior reset`);
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${USER_COUNT} users + ${EVENT_COUNT} events (Dundee-weighted)...\n`);

  // Weighted city assignment: expand CITY_USER_TARGETS into a flat list so each
  // persona lands in the right city (Dundee densest). idx stays global so avatar
  // portraits don't collide within a gender bucket.
  const cityPlan: City[] = [];
  for (const t of CITY_USER_TARGETS) {
    for (let n = 0; n < t.count; n++) cityPlan.push(t.city);
  }

  console.log('0/7  Sweeping orphaned seed events from a prior reset');
  await cleanupOrphanSeedEvents();

  console.log('\n1/7  Creating personas');
  const personas: Persona[] = [];
  for (let i = 0; i < cityPlan.length; i++) {
    const city = cityPlan[i];
    const persona = await createPersona(i, city);
    personas.push(persona);
    process.stdout.write(`     ${i + 1}/${cityPlan.length} ${persona.name.padEnd(28)} (${city.name})\n`);
  }

  console.log('\n2/7  Building friendship graph');
  await buildFriendships(personas);

  console.log('\n3/7  Generating visits');
  await createVisits(personas);

  console.log('\n4/7  Creating events (sidequests) + attendance');
  const { eventIds, dundeeEventIds } = await createEvents(personas);

  console.log('\n5/7  Backfilling group chats + DMs');
  await backfillGroupChats(eventIds);
  await createDMs(personas);

  console.log('\n6/7  Sentinels');
  await createSentinels(personas);

  console.log('\n7/7  Owner hookup (optional)');
  await hookupOwner(personas, dundeeEventIds);

  const dundeeCount = personas.filter((p) => p.city.name === HERO_CITY.name).length;
  console.log('\nDone. Log in with any seeded user:');
  console.log(`  Email:    <username>${SEED_EMAIL_DOMAIN}`);
  console.log(`  Password: ${SEED_PASSWORD}`);
  console.log(`\n${dundeeCount} personas + ${dundeeEventIds.length} sidequests seeded in Dundee.`);
  console.log('Examples:');
  for (const p of personas.filter((x) => x.city.name === HERO_CITY.name).slice(0, 3)) {
    console.log(`  ${p.email}  (${p.city.name})`);
  }
  console.log(`\nPro-tier sentinel: ${personas.find((p) => p.city.name === HERO_CITY.name)?.email ?? personas[0].email}`);
}

main().catch((err) => {
  console.error('\nSEED FAILED:', err.message ?? err);
  process.exit(1);
});
