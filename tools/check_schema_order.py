#!/usr/bin/env python3
"""
tools/check_schema_order.py — upgrade-order safety checker (round 9, fix follow-up)

WHY THIS EXISTS
---------------
Running complete-schema.sql against an EXISTING project is not the same as
running it against an empty database. Every table is created with
`create table if not exists`, so on an existing project the CREATE is
silently SKIPPED and the table keeps its OLD shape. If a column was added
in a later version (e.g. messages.recipient in V44) and an INDEX or POLICY
that references it sits in the file BEFORE the `alter table ... add column
if not exists` that upgrades the table, the run dies with
    ERROR: 42703: column "recipient" does not exist
— exactly the report from the field.

THE RULE THIS CHECKER ENFORCES
------------------------------
An index or policy referencing column C of table T is safe only if, by the
time it executes, C is guaranteed present on BOTH a fresh database AND a
legacy database whose table T predates C. That means C must be introduced
by an `alter table T add column if not exists C` that appears BEFORE the
index/policy (alters run on both fresh and legacy; a base CREATE TABLE only
helps fresh databases, because it is skipped on legacy ones whenever the
table already exists).

Exit code 0 = safe, 1 = violations found. Run:
    python3 tools/check_schema_order.py [database/complete-schema.sql ...]
"""
import re
import sys

CREATE_RE = re.compile(r'create\s+table\s+if\s+not\s+exists\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(', re.I)
ALTER_RE = re.compile(
    r'alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+'
    r'add\s+column\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)', re.I)
ADD_COL_RE = re.compile(r'add\s+column\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)', re.I)
INDEX_HEAD_RE = re.compile(
    r'create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?[a-z_][a-z0-9_]*\s+'
    r'on\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(', re.I)


def balanced_paren(text, open_idx):
    """Given index of '(', return (content, end_index) of the balanced group."""
    depth, i = 0, open_idx
    while i < len(text):
        if text[i] == '(':
            depth += 1
        elif text[i] == ')':
            depth -= 1
            if depth == 0:
                return text[open_idx + 1:i], i
        i += 1
    return text[open_idx + 1:], len(text)
POLICY_RE = re.compile(
    r'create\s+policy\s+[a-z_][a-z0-9_]*\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)'
    r'([\s\S]*?);', re.I)

def statements(path, keep_dollar=False):
    """Return (kept_text, dollar_ranges) where comments are stripped and
    $$-quoted bodies are either elided to a placeholder (default) or kept
    verbatim with their (start, end) ranges recorded — in KEPT-TEXT
    coordinates, so callers can slice the returned string directly. A real
    state machine keeps $$, -- and quotes inside each other honest."""
    text = open(path).read()
    out = []
    pos_out = 0            # running CHARACTER position in ''.join(out)
    dollar_ranges = []     # (start, end) of each kept body, kept-coords

    def emit(chunk):
        nonlocal pos_out
        out.append(chunk)
        pos_out += len(chunk)

    i, n = 0, len(text)
    state = 'code'         # code | line | block | squote | dollar
    dollar_tag = ''
    dstart_out = 0
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ''
        if state == 'code':
            if ch == '-' and nxt == '-':
                state = 'line'; i += 2; continue
            if ch == '/' and nxt == '*':
                state = 'block'; i += 2; continue
            if ch == "'":
                state = 'squote'; i += 1; emit(ch); continue
            if ch == '$':
                m = re.match(r'\$[A-Za-z_]*\$', text[i:])
                if m:
                    # in code state a dollar tag can only OPEN a body
                    state = 'dollar'; dollar_tag = m.group(0)
                    if keep_dollar:
                        dstart_out = pos_out          # before the opening tag
                        emit(m.group(0))
                    i += len(m.group(0)); continue
            emit(ch); i += 1; continue
        if state == 'line':
            if ch == '\n':
                state = 'code'; emit(ch)
            i += 1; continue
        if state == 'block':
            if ch == '*' and nxt == '/':
                state = 'code'; emit(' '); i += 2; continue
            i += 1; continue
        if state == 'squote':
            emit(ch)          # keep string contents: dropping them would
            if ch == "'":     # corrupt check (… in ('a','b')) and
                if nxt == "'":   # default '…,…' fragments
                    emit(nxt)
                    i += 2; continue
                state = 'code'
            i += 1; continue
        if state == 'dollar':
            if text.startswith(dollar_tag, i):
                tag = text[i:i + len(dollar_tag)]
                i += len(dollar_tag); dollar_tag = ''; state = 'code'
                if keep_dollar:
                    emit(tag)                        # closing tag
                    dollar_ranges.append((dstart_out, pos_out))
                else:
                    emit(' __DOLLAR_BODY__ ')        # body elided once
                continue
            if keep_dollar:
                emit(ch)           # body kept verbatim
            i += 1; continue
    return ''.join(out), dollar_ranges if keep_dollar else ''.join(out)


def split_top_level(body):
    """Split a create-table body / index column list on top-level commas,
    respecting nested parens AND single-quoted strings (a default like
    '{Mon,Tue}' must never be split)."""
    parts, cur, depth, in_str = [], [], 0, False
    i, n = 0, len(body)
    while i < n:
        ch = body[i]
        if in_str:
            cur.append(ch)
            if ch == "'":
                if i + 1 < n and body[i + 1] == "'":
                    cur.append(body[i + 1]); i += 2; continue
                in_str = False
            i += 1; continue
        if ch == "'":
            in_str = True; cur.append(ch); i += 1; continue
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(''.join(cur)); cur = []
        else:
            cur.append(ch)
        i += 1
    if cur:
        parts.append(''.join(cur))
    return parts


def table_columns_from_create(stmt):
    """Column names from a create-table body (top level only)."""
    stmt = stmt.strip()
    if stmt.startswith('(') and stmt.endswith(')'):
        stmt = stmt[1:-1]          # unwrap: columns live one level inside
    parts = split_top_level(stmt)
    names = set()
    for p in parts:
        p = p.strip()
        if not p:
            continue
        first = re.match(r'"?([a-z_][a-z0-9_]*)"?\s', p, re.I)
        if first and first.group(1).lower() not in (
                'primary', 'foreign', 'unique', 'check', 'constraint', 'exclude'):
            names.add(first.group(1).lower())
    return names


# Tempered windows: the head cannot cross another `create` or any dollar
# sign, so a plpgsql function can never swallow the NEXT function's
# `language sql` clause (which once misattributed bodies to wrong heads).
SQLFN_RE = re.compile(
    r'create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)'
    r'((?:(?!\bcreate\b|\$)[\s\S]){0,600}?)language\s+sql\s+'
    r'(?:(?!\bcreate\b|\$)[\s\S]){0,400}?as\s+\$[A-Za-z_]*\$', re.I)
VIEW_RE = re.compile(
    r'create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+as\s', re.I)
ALIAS_RE = re.compile(
    r'(?:from|join)\s+(?:public\.)?([a-z_][a-z0-9_]*)(?:\s+(?:as\s+)?([a-z_][a-z0-9_]*))?',
    re.I)
REF_RE = re.compile(r'\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b', re.I)


def in_ranges(ranges, pos):
    return any(a <= pos < b for (a, b) in ranges)


def check(path):
    kept, dollar_ranges = statements(path, keep_dollar=True)
    clean = kept          # same text; dollar ranges tracked separately
    # position maps: for each table, list of (pos, column, kind) introductions
    base = {}                       # table -> (pos, {cols})
    alters = {}                     # table -> [(pos, col)]
    problems = []

    for m in CREATE_RE.finditer(clean):
        t = m.group(1).lower()
        body, _ = balanced_paren(clean, m.end() - 1)
        cols = table_columns_from_create('(' + body + ')')
        if t not in base:
            base[t] = (m.start(), cols)

    for m in ALTER_RE.finditer(clean):
        t = m.group(1).lower()
        # r17: one ALTER statement may add SEVERAL columns
        # (`alter table t add column if not exists a …, add column if not
        #  exists b …`). The old single-capture regex registered only the
        # FIRST column of such statements, so a later column (e.g.
        # library_items.tutor_id in the V43 pack) was treated as
        # never-alter-introduced and escaped checking entirely. Register
        # every add-column clause of the statement at its position.
        end = clean.find(';', m.end())
        span = clean[m.start():end if end != -1 else len(clean)]
        for cm in ADD_COL_RE.finditer(span):
            alters.setdefault(t, []).append((m.start(), cm.group(1).lower()))

    def known_before(t, pos):
        """Columns guaranteed present on a LEGACY db by position pos."""
        cols = set()
        for (apos, col) in alters.get(t, []):
            if apos < pos:
                cols.add(col)
        return cols

    def any_version_column(t, col):
        """Does the file introduce this column at all (create or alter)?"""
        if t in base and col in base[t][1]:
            return True
        return any(c == col for (_, c) in alters.get(t, []))

    def verdict(t, col, pos):
        """Why column col of table t is or is not safe at position pos.

        SAFE  — an `alter table add column if not exists` for it already ran
                (covers fresh AND legacy databases), or it is an ORIGINAL
                column (in the base create, never altered anywhere in this
                file — every shape ever shipped has it).
        UNSAFE — the file proves the column was added in a later version (it
                also carries an alter for it) but the referencing statement
                runs before that alter: on a legacy database the base create
                is skipped and the column is still missing. This is the
                42703 class reported from the field.
        NEVER  — the column is not introduced anywhere: broken even on a
                fresh database.
        """
        alter_positions = [a for (a, c) in alters.get(t, []) if c == col]
        if any(a < pos for a in alter_positions):
            return 'SAFE'
        if t in base and col in base[t][1] and base[t][0] < pos:
            return 'SAFE' if not alter_positions else 'UNSAFE'
        return 'NEVER' if not any_version_column(t, col) else 'UNSAFE'

    for m in INDEX_HEAD_RE.finditer(clean):
        t = m.group(1).lower()
        if in_ranges(dollar_ranges, m.start()):
            continue  # inside a function body — not live DDL
        if t not in base:
            continue  # storage.objects etc. — environment-provided
        raw, _ = balanced_paren(clean, m.end() - 1)
        parts = split_top_level(raw)
        refs = []
        for c in parts:
            c = c.strip()
            if not c:
                continue
            # unwrap functional index expressions: lower(email) -> email
            inner = re.search(r'\(([a-z_][a-z0-9_]*)\)', c)
            tok = inner.group(1) if inner else c.split()[0]
            tok = re.sub(r'::.*$', '', tok)
            refs.append(tok.lower())
        for col in refs:
            if not col or col == '':
                continue
            v = verdict(t, col, m.start())
            if v == 'SAFE':
                continue
            why = ('column is never defined in this file' if v == 'NEVER'
                   else 'version-added column, ALTER sits later — move the '
                        'ALTER above this index (legacy databases fail here '
                        'with 42703)')
            problems.append((m.start(), 'index', t, col, why))

    for m in POLICY_RE.finditer(clean):
        t = m.group(1).lower()
        if in_ranges(dollar_ranges, m.start()):
            continue
        if t not in base:
            continue
        expr = m.group(2)
        # candidate identifiers in the policy expression
        ids = set(x.lower() for x in re.findall(r'\b[a-z_][a-z0-9_]*\b', expr))
        all_cols = set(base[t][1]) | set(c for (_, c) in alters.get(t, []))
        for col in sorted(ids & all_cols):
            if verdict(t, col, m.start()) == 'SAFE':
                continue
            problems.append((m.start(), 'policy', t, col,
                             'version-added column, ALTER sits later — move '
                             'the ALTER above this policy (legacy databases '
                             'fail here with 42703)'))

    # ── SQL-language functions and VIEWS: Postgres validates their column
    #    references at CREATE time, so they are as order-sensitive as indexes.
    #    (plpgsql bodies are NOT validated at create and are safe to define
    #    before their columns exist.)
    SQL_WORDS = {'select', 'where', 'and', 'or', 'not', 'left', 'right',
                 'inner', 'outer', 'cross', 'lateral', 'on', 'using',
                 'union', 'values', 'with', 'set', 'do', 'then', 'else',
                 'end', 'case', 'when', 'distinct', 'limit', 'offset',
                 'group', 'order', 'having', 'returning', 'default', 'as',
                 'is', 'in', 'exists', 'filter', 'all', 'any', 'some', 'for',
                 'to', 'from', 'join', 'into', 'by', 'asc', 'desc', 'nulls',
                 'cast', 'coalesce', 'nullif', 'interval', 'generate_series'}

    def strip_strings(body):
        """Blank single-quoted literals: 'e.g. TC-0001' would otherwise
        register as an alias.column reference (alias e, column g)."""
        out, in_str = [], False
        i, n = 0, len(body)
        while i < n:
            ch = body[i]
            if in_str:
                if ch == "'":
                    if i + 1 < n and body[i + 1] == "'":
                        i += 2; continue
                    in_str = False
                    out.append(' ')
                i += 1; continue
            if ch == "'":
                in_str = True; out.append(' '); i += 1; continue
            out.append(ch); i += 1
        return ''.join(out)

    def body_refs(body):
        body = strip_strings(body)
        aliases = {}
        for am in ALIAS_RE.finditer(body):
            t = am.group(1).lower()
            if t in SQL_WORDS:
                continue
            a = (am.group(2) or '').lower()
            if a in SQL_WORDS or not a:
                a = t          # no real alias — refer to it by table name
            aliases[a] = t
        refs = set()
        for rm in REF_RE.finditer(body):
            a, col = rm.group(1).lower(), rm.group(2).lower()
            if a in aliases:
                refs.add((aliases[a], col))
        return refs

    bodies = []
    for m in SQLFN_RE.finditer(clean):
        # the body is the first dollar range starting at/after this head
        cand = [r for r in dollar_ranges if r[0] >= m.start()]
        if cand:
            bodies.append(('function ' + m.group(1), cand[0][0], clean[cand[0][0]:cand[0][1]]))
    for m in VIEW_RE.finditer(clean):
        if in_ranges(dollar_ranges, m.start()):
            continue
        end = clean.find(';', m.end())
        if end == -1:
            end = len(clean)
        bodies.append(('view ' + m.group(1), m.start(), clean[m.end():end]))

    for (what, pos, body) in bodies:
        for (t, col) in body_refs(body):
            if t not in base:
                continue          # environment table (auth.users etc.)
            v = verdict(t, col, pos)
            if v == 'SAFE':
                continue
            why = ('column is never defined in this file' if v == 'NEVER'
                   else 'SQL body validated at CREATE time; version-added '
                        'column ALTER sits later — legacy databases fail '
                        'here with 42703')
            problems.append((pos, what, t, col, why))

    return problems, clean


def main():
    files = sys.argv[1:] or ['database/complete-schema.sql']
    bad = 0
    for f in files:
        problems, clean = check(f)
        line_of = lambda pos: clean.count('\n', 0, pos) + 1
        if problems:
            bad += 1
            print(f'{f}: {len(problems)} UPGRADE-ORDER VIOLATION(S)')
            seen = set()
            for (pos, kind, t, col, why) in problems:
                key = (kind, t, col)
                if key in seen:
                    continue
                seen.add(key)
                print(f'  line ~{line_of(pos):>6}: {kind} on {t} references "{col}" — {why}')
        else:
            print(f'{f}: OK — every index/policy column is alter-guaranteed before first use')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
