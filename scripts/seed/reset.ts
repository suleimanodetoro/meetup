import { admin, SEED_EMAIL_DOMAIN } from './env';

// Wipe everything seeded. Identifies seed users by their @seed.local email and
// relies on ON DELETE CASCADE in the schema to clean up their content.
async function main() {
  console.log(`Resetting seed data (users matching ${SEED_EMAIL_DOMAIN})...`);

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const seedUsers = data.users.filter((u) => u.email?.endsWith(SEED_EMAIL_DOMAIN));
  console.log(`Found ${seedUsers.length} seed users to delete.`);

  let deleted = 0;
  for (const user of seedUsers) {
    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`Failed to delete ${user.email}:`, delError.message);
    } else {
      deleted += 1;
    }
  }

  console.log(`Deleted ${deleted}/${seedUsers.length} seed users.`);
  console.log('Cascades have removed associated profiles, visits, events, attendance, messages, etc.');

  // Paranoia sweep: anything whose user_id no longer matches a real profile is
  // orphaned and safe to drop. Cascades *should* mean this finds nothing, but
  // a missing FK or hand-edited prod row could leave dangling content.
  console.log('\nSweeping for orphan rows (events/visits without a valid profile)...');
  const { data: liveIds } = await admin.from('profiles').select('id');
  const liveSet = new Set((liveIds ?? []).map((r) => r.id));

  for (const table of ['events', 'visits'] as const) {
    const { data: rows } = await admin.from(table).select('id, user_id');
    if (!rows) continue;
    const orphans = rows.filter((r) => r.user_id && !liveSet.has(r.user_id));
    if (orphans.length === 0) {
      console.log(`  ${table}: none`);
      continue;
    }
    const { error } = await admin
      .from(table)
      .delete()
      .in('id', orphans.map((o) => o.id));
    if (error) {
      console.error(`  ${table}: failed to delete ${orphans.length} orphans —`, error.message);
    } else {
      console.log(`  ${table}: deleted ${orphans.length} orphans`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
