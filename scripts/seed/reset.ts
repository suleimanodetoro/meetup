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
  console.log('Done. Cascades have removed associated profiles, visits, events, attendance, messages, etc.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
