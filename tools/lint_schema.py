#!/usr/bin/env python3
"""
lint_schema.py — idempotency + safety linter for Tutoring Connect SQL.

WHY THIS EXISTS
`complete-schema.sql` is the one file an operator runs, and they may run it
more than once (after an upgrade, after a partial failure, or just because the
guide told them to). Anything in it that is not re-runnable turns a routine
re-run into an error wall, which is exactly how a studio ends up stranded on an
old schema — the V4-vs-V9 drift we found on the live ADEWALE CLASSROOM project.

This linter checks every statement for re-runnability:

  create table            -> must be IF NOT EXISTS
  create index            -> must be IF NOT EXISTS
  create function         -> must be CREATE OR REPLACE
  create policy           -> must be preceded by DROP POLICY IF EXISTS
  create trigger          -> must be preceded by DROP TRIGGER IF EXISTS
  add column              -> must be IF NOT EXISTS
  create type/enum        -> must be guarded by a DO $$ ... exception block
  insert seed rows        -> must have ON CONFLICT
  create extension        -> must be IF NOT EXISTS

It also parses the whole file with the real PostgreSQL grammar (pglast) and
reports duplicated object definitions, which are harmless but indicate the file
has drifted into an append-only pile.

Usage:  python3 tools/lint_schema.py [file ...]
Exit code 1 if any BLOCKER is found.
"""
import re, sys, os, collections

def strip_dollar_bodies(sql):
    """Blank out $tag$ ... $tag$ bodies so we never lint inside a function body."""
    out, i = [], 0
    pat = re.compile(r'\$([a-zA-Z_]*)\$')
    while True:
        m = pat.search(sql, i)
        if not m:
            out.append(sql[i:]); break
        out.append(sql[i:m.end()])
        close = sql.find(m.group(0), m.end())
        if close == -1:
            out.append(sql[m.end():]); break
        out.append('\n' * sql.count('\n', m.end(), close))   # keep line numbers
        out.append(m.group(0))
        i = close + len(m.group(0))
    return ''.join(out)

def lint(path):
    raw = open(path, encoding='utf-8').read()
    sql = strip_dollar_bodies(raw)
    sql_nc = re.sub(r'--[^\n]*', '', sql)          # drop line comments
    lines = sql_nc.split('\n')
    blockers, warns = [], []

    def at(i): return f"{os.path.basename(path)}:{i+1}"

    # --- statement-level idempotency ---
    for i, ln in enumerate(lines):
        l = ln.strip().lower()
        if re.match(r'create table\s', l) and 'if not exists' not in l:
            blockers.append(f"{at(i)} create table without IF NOT EXISTS -> {ln.strip()[:70]}")
        if re.match(r'create (unique )?index\s', l) and 'if not exists' not in l:
            blockers.append(f"{at(i)} create index without IF NOT EXISTS -> {ln.strip()[:70]}")
        if re.match(r'create function\s', l):
            blockers.append(f"{at(i)} create function (use CREATE OR REPLACE) -> {ln.strip()[:70]}")
        if 'add column' in l and 'if not exists' not in l:
            blockers.append(f"{at(i)} add column without IF NOT EXISTS -> {ln.strip()[:70]}")
        if re.match(r'create (type|domain)\s', l):
            warns.append(f"{at(i)} create type/domain is not idempotent unless wrapped in a DO block")
        if re.match(r'create extension\s', l) and 'if not exists' not in l:
            blockers.append(f"{at(i)} create extension without IF NOT EXISTS")
        if re.match(r'create (or replace )?view\s', l) and 'or replace' not in l:
            blockers.append(f"{at(i)} create view without OR REPLACE")

    # --- policies need a preceding drop (same name+table) ---
    dropped = set()
    for m in re.finditer(r'drop policy if exists\s+"?([a-z_0-9]+)"?\s+on\s+(?:public\.)?([a-z_0-9]+)', sql_nc, re.I):
        dropped.add((m.group(1).lower(), m.group(2).lower()))
    for m in re.finditer(r'create policy\s+"?([a-z_0-9]+)"?\s+on\s+(?:public\.)?([a-z_0-9]+)', sql_nc, re.I):
        key = (m.group(1).lower(), m.group(2).lower())
        if key not in dropped:
            ln = sql_nc.count('\n', 0, m.start())
            blockers.append(f"{at(ln)} create policy {key[0]} on {key[1]} with no DROP POLICY IF EXISTS")

    # --- triggers need a preceding drop ---
    dropped_t = {m.group(1).lower() for m in
                 re.finditer(r'drop trigger if exists\s+([a-z_0-9]+)', sql_nc, re.I)}
    for m in re.finditer(r'create trigger\s+([a-z_0-9]+)', sql_nc, re.I):
        if m.group(1).lower() not in dropped_t:
            ln = sql_nc.count('\n', 0, m.start())
            blockers.append(f"{at(ln)} create trigger {m.group(1)} with no DROP TRIGGER IF EXISTS")

    # --- seed inserts must tolerate a re-run ---
    for m in re.finditer(r'insert into\s+(?:public\.)?([a-z_0-9.]+)([^;]*);', sql_nc, re.I | re.S):
        body = m.group(0).lower()
        if 'on conflict' not in body and 'select' not in body.split('values')[0]:
            ln = sql_nc.count('\n', 0, m.start())
            warns.append(f"{at(ln)} insert into {m.group(1)} without ON CONFLICT (re-run may duplicate)")

    # --- duplicated definitions (harmless, but signals drift) ---
    dupes = []
    for kind, pat in [('function', r'create or replace function\s+(?:public\.)?([a-z_0-9]+)\s*\('),
                      ('table',    r'create table if not exists\s+(?:public\.)?([a-z_0-9]+)'),
                      ('trigger',  r'create trigger\s+([a-z_0-9]+)')]:
        c = collections.Counter(m.group(1).lower() for m in re.finditer(pat, sql_nc, re.I))
        for name, n in c.items():
            if n > 1:
                dupes.append(f"{kind} {name} defined {n}x")

    # --- grammar check ---
    # A missing linter dependency is NOT a schema defect. Report it as a
    # warning so CI still runs the structural checks, which need no imports.
    parse_err = None
    try:
        import pglast
    except ImportError:
        warns.append("pglast not installed - grammar check skipped (pip install pglast)")
    else:
        try:
            pglast.parse_sql(raw)
        except Exception as e:
            parse_err = str(e)[:200]

    return blockers, warns, dupes, parse_err

def main():
    files = sys.argv[1:] or ['database/complete-schema.sql']
    total_block = 0
    for f in files:
        if not os.path.exists(f):
            print(f"  MISSING {f}"); total_block += 1; continue
        b, w, d, pe = lint(f)
        n = sum(1 for _ in open(f, encoding='utf-8'))
        status = 'BLOCKERS' if (b or pe) else 'OK'
        print(f"\n=== {f}  ({n} lines)  [{status}] ===")
        if pe: print(f"  ✗ PARSE ERROR: {pe}")
        for x in b: print(f"  ✗ BLOCKER {x}")
        for x in w[:8]: print(f"  ! warn    {x}")
        if len(w) > 8: print(f"  ! warn    …and {len(w)-8} more")
        for x in d: print(f"  · dupe    {x}")
        if not (b or w or d or pe): print("  ✓ fully idempotent — safe to run repeatedly")
        total_block += len(b) + (1 if pe else 0)
    print(f"\nTOTAL BLOCKERS: {total_block}")
    sys.exit(1 if total_block else 0)

if __name__ == '__main__':
    main()
