#!/usr/bin/env bash
set -euo pipefail

database_url="${SUPABASE_TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "$database_url" in
  postgresql://*@127.0.0.1:*/*|postgresql://*@localhost:*/*) ;;
  *)
    echo "Refusing to run destructive database fixtures against a non-local URL." >&2
    exit 1
    ;;
esac

for command_name in psql pgbench; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required for database regressions." >&2
    exit 1
  fi
done

psql_args=("$database_url" -X -v ON_ERROR_STOP=1)

run_sql() {
  local file="$1"
  echo "==> $file"
  psql "${psql_args[@]}" -f "$file"
}

cleanup_concurrency() {
  psql "${psql_args[@]}" -f supabase/tests/autogen_concurrency_setup.sql >/dev/null 2>&1 || true
}
trap cleanup_concurrency EXIT

run_sql supabase/tests/fixtures.sql
run_sql supabase/tests/friend_request_consent.sql
run_sql supabase/tests/chemistry_security_symmetry.sql
run_sql supabase/tests/intent_capture_atomicity.sql
run_sql supabase/tests/autogen_transactional_idempotency.sql
run_sql supabase/tests/autogen_concurrency_setup.sql

echo "==> supabase/tests/autogen_concurrency.pgbench.sql (two clients)"
pgbench "$database_url" -n -c 2 -j 2 -t 1 \
  -f supabase/tests/autogen_concurrency.pgbench.sql

run_sql supabase/tests/autogen_concurrency_verify.sql
trap - EXIT

echo "All database regressions passed."
