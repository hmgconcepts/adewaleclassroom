#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# tools/verify_schema_pg.sh — run the REAL schema against REAL Postgres.
#
# Why: the round-9 field report (ERROR: 42703: column "recipient" does not
# exist) only reproduces on a database that ALREADY HAS the older tables —
# `create table if not exists` skips, and any index/policy that references
# a version-added column before its ALTER runs will kill the whole script
# (Supabase's SQL editor aborts on the first error).
#
# This harness proves, on a local PostgreSQL, that database/complete-schema.sql
# runs ERROR-FREE in every scenario:
#   1. FRESH        — empty database (brand-new Supabase project)
#   2. LEGACY       — database shaped like an OLDER install: every table
#                     that the schema alters later is pre-created WITHOUT
#                     those version-added columns (worst realistic case)
#   3. RE-RUN       — the same schema applied a SECOND time (idempotency)
#   4. MIGRATIONS   — v44-messaging.sql and v45-health-cbt.sql applied
#                     standalone to the legacy shape
#
# Requirements: psql + a running local PostgreSQL with a user that can
# create databases (uses sudo -u postgres by default; override with
# PGBIN / PGUSER / PGSUPER). Postgres is NOT required for normal battery
# runs — when absent this script exits 77 (skip).
#
# Usage:  bash tools/verify_schema_pg.sh [repo-root]
# ═══════════════════════════════════════════════════════════════════════
set -u
REPO="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
PSQL="$(command -v psql || true)"
[ -z "$PSQL" ] && { echo "SKIP: psql not installed (exit 77)"; exit 77; }

if ! sudo -n true 2>/dev/null; then
  echo "SKIP: passwordless sudo unavailable for the postgres superuser (exit 77)"; exit 77
fi

# NB: files are ALWAYS piped through stdin — the postgres OS user cannot
# read files under /home/user, and copying to /tmp is a race we do not need.
run()   { sudo -n -u postgres psql -v ON_ERROR_STOP=0 -q "$@"; }
runf()  { run -d "$1" < "$2"; }   # runf <db> <file>
createdb() { sudo -n -u postgres createdb "$1" 2>/dev/null || true; }
dropdb()   { sudo -n -u postgres dropdb --if-exists "$1" 2>/dev/null || true; }

STUBS="$REPO/tools/pg_stubs.sql"
SCHEMA="$REPO/database/complete-schema.sql"
V44="$REPO/database/v44-messaging.sql"
V45="$REPO/database/v45-health-cbt.sql"
V46="$REPO/database/v46-cbt-automation.sql"
V47="$REPO/database/v47-cloud-credentials.sql"
V48="$REPO/database/v48-notification-links.sql"
V49="$REPO/database/v49-family-library-access.sql"
V50="$REPO/database/v50-staff-access-truth.sql"
V51="$REPO/database/v51-family-ref-labels-library-quiz.sql"
V52="$REPO/database/v52-timezone-truth.sql"
V53="$REPO/database/v53-credential-truth-staff-monitor.sql"

# The worst-case LEGACY shape, generated mechanically from the schema
# itself: every table that carries a later `alter table add column` is
# pre-created WITHOUT those columns — exactly the database shape that
# produced the field report.
LEGACY_SQL="$(python3 "$REPO/tools/gen_legacy_shape.py" "$REPO")" \
  || { echo "legacy-shape generation failed"; exit 1; }

fails=0
scenario() { # name, db, files...
  local name="$1" db="$2"; shift 2
  dropdb "$db"; createdb "$db"
  : > /tmp/pgverify_$db.log
  for f in "$@"; do
    if [ "$f" = "__LEGACY__" ]; then
      printf '%s\n' "$LEGACY_SQL" | run -d "$db" >> /tmp/pgverify_$db.log 2>&1
    else
      runf "$db" "$f" >> /tmp/pgverify_$db.log 2>&1
    fi
  done
  local n
  n=$(grep -ciE 'psql:.*(error|permission|fatal)|ERROR' /tmp/pgverify_$db.log || true)
  if [ "$n" = "0" ]; then
    echo "  ✅ $name — 0 errors"
  else
    echo "  ❌ $name — $n error(s):"
    grep -iE 'psql:.*(error|permission|fatal)|ERROR' /tmp/pgverify_$db.log | head -5 | sed 's/^/       /'
    fails=$((fails + 1))
  fi
}

echo "═══ verify_schema_pg: $REPO ═══"
scenario "1. FRESH  (empty database)"                 tcv_fresh  "$STUBS" "$SCHEMA"
scenario "2. LEGACY (pre-upgrade table shapes)"        tcv_legacy "$STUBS" __LEGACY__ "$SCHEMA"
scenario "3. RE-RUN (same schema twice)"               tcv_rerun  "$STUBS" "$SCHEMA" "$SCHEMA"
scenario "4. MIGRATIONS standalone on LEGACY"          tcv_migr   "$STUBS" __LEGACY__ "$V44" "$V45" "$V46" "$V47" "$V48" "$V49" "$V50" "$V51" "$V52" "$V53"

# 5. V46 CBT→assignment automation, behaviorally: the mirror must appear on
#    publish (with sit link + max score), follow edits, vanish on archive,
#    return on restore, and never orphan on delete. Asserts via RAISE, so
#    any broken expectation surfaces as an ERROR and fails the scenario.
scenario "5. V46 assignment automation behavior"       tcv_v46    "$STUBS" "$SCHEMA" "$V46" "$REPO/tools/v46_behavior.sql"

# 6. V47 school settings + roaming credentials + family↔staff messaging,
#    exercised AS the authenticated role with jwt claims (RLS proven).
scenario "6. V47 cloud credentials + messaging behavior" tcv_v47  "$STUBS" "$SCHEMA" "$V47" "$REPO/tools/v47_behavior.sql"

# 7. V48 notification deep links: every raised notification carries a url.
scenario "7. V48 notification deep-link behavior"      tcv_v48    "$STUBS" "$SCHEMA" "$V48" "$REPO/tools/v48_behavior.sql"

# 8. V49 family library access: assigned students/parents see class shelves,
#    drafts stay hidden, reading links work, notifications clearable.
scenario "8. V49 family library access behavior"       tcv_v49    "$STUBS" "$SCHEMA" "$V49" "$REPO/tools/v49_behavior.sql"

# 9. V50 staff access truth: pending-status owners read engagements (the
#    "linked · name unavailable" root cause), approval workflow stays real,
#    tc_ref_labels fallback works, LMS publishes by default.
scenario "9. V50 staff access truth behavior"          tcv_v50    "$STUBS" "$SCHEMA" "$V50" "$REPO/tools/v50_behavior.sql"

# 10. V51 role-aware ref labels (student-portal names), library quiz
#     attempts visibility, cloud last-backup column.
scenario "10. V51 family ref labels + library quiz"    tcv_v51    "$STUBS" "$SCHEMA" "$V51" "$REPO/tools/v51_behavior.sql"

# 11. V52 timezone truth: tc_my_tz() answers home + the viewer's own zone.
scenario "11. V52 timezone truth behavior"             tcv_v52    "$STUBS" "$SCHEMA" "$V52" "$REPO/tools/v52_behavior.sql"

# 12. V53 credential truth + backup stamp + tutor isolation + staff monitor.
scenario "12. V53 credential truth + staff monitor"     tcv_v53    "$STUBS" "$SCHEMA" "$V53" "$REPO/tools/v53_behavior.sql"

if [ "$fails" = "0" ]; then
  echo "═══ ALL SCENARIOS CLEAN ═══"
  dropdb tcv_fresh; dropdb tcv_legacy; dropdb tcv_rerun; dropdb tcv_migr; dropdb tcv_v46; dropdb tcv_v47; dropdb tcv_v48; dropdb tcv_v49; dropdb tcv_v50; dropdb tcv_v51; dropdb tcv_v52; dropdb tcv_v53
  exit 0
else
  echo "═══ $fails SCENARIO(S) FAILED — logs in /tmp/pgverify_* ═══"
  exit 1
fi
