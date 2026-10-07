#!/usr/bin/env python3
"""
tools/gen_legacy_shape.py — worst-case LEGACY database generator.

Emits SQL that pre-creates every table complete-schema.sql might ALTER
later, in its OLD shape (without any column the schema adds via
`alter table ... add column if not exists`). Piping this into a fresh
database simulates an install from an older version — the exact scenario
that produced the round-9 field report (ERROR: 42703: column "recipient"
does not exist), where `create table if not exists` silently skips and
early indexes/policies hit columns that only arrive at the end of the file.

Usage:
    python3 tools/gen_legacy_shape.py /path/to/repo > legacy.sql
"""
import re
import sys

sys.path.insert(0, __file__.rsplit('/', 2)[0] + '/tools')
from check_schema_order import (statements, CREATE_RE, ALTER_RE,
                                balanced_paren, split_top_level)

CONSTRAINT_RE = re.compile(r'^(primary|foreign|unique|check|constraint|exclude)\b', re.I)
COLNAME_RE = re.compile(r'"?([a-z_][a-z0-9_]*)"?\s', re.I)


def main(repo):
    schema = repo.rstrip('/') + '/database/complete-schema.sql'
    clean, _ = statements(schema)

    base, altered = {}, {}
    for m in CREATE_RE.finditer(clean):
        t = m.group(1).lower()
        if t not in base:
            base[t] = balanced_paren(clean, m.end() - 1)[0]
    for m in ALTER_RE.finditer(clean):
        altered.setdefault(m.group(1).lower(), set()).add(m.group(2).lower())

    def cols_of(body):
        out = []
        for p in split_top_level(body):
            p = p.strip()
            if not p or CONSTRAINT_RE.match(p):
                continue
            name = COLNAME_RE.match(p)
            if name:
                out.append((name.group(1).lower(), p))
        return out

    # An older install had the schema functions its own version defined —
    # pre-create the ones old tables reference in column defaults (the
    # complete schema re-defines them properly later in the run).
    print('create or replace function public.tc_actor() '
          'returns uuid language sql stable as $$ select auth.uid() $$;')

    made = 0
    for t, body in base.items():
        drop = altered.get(t, set())
        keep = [(c, d) for (c, d) in cols_of(body) if c not in drop]
        if not keep:
            continue
        print(f'drop table if exists public.{t} cascade;')
        print(f'create table public.{t} (')
        print(',\n'.join('  ' + d for _, d in keep))
        print(');')
        made += 1
    print(f'-- {made} legacy tables pre-created', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
