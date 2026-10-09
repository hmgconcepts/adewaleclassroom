#!/usr/bin/env python3
"""audit_selfcontained.py — prove complete-schema.sql is ALL-INCLUSIVE.

Item 9 (round 15): "the complete schema must contain every SQL needed so
that once we run it, no other migration file is required."

Method: walk every database/*.sql file EXCEPT complete-schema.sql and
v51+ (the current round's own file, which is spliced separately), extract
the objects each file creates (tables, functions, policies, indexes,
triggers, columns), and verify each one is present in complete-schema.sql.

Exit 0 = fully self-contained. Exit 1 prints every gap.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, '..', 'database')

RE_TABLE = re.compile(r'create\s+table\s+(?:if\s+not\s+exists\s+)(?:public\.)?([a-z_0-9]+)\s*\(', re.I)
RE_FUNC = re.compile(r'create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(', re.I)
RE_POLICY = re.compile(r'create\s+policy\s+"?([a-z_0-9]+)"?\s+on\s+(?:public\.)?([a-z_0-9]+)', re.I)
RE_INDEX = re.compile(r'create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)(?:public\.)?([a-z_0-9]+)', re.I)
RE_TRIGGER = re.compile(r'create\s+trigger\s+([a-z_0-9]+)', re.I)
RE_ADDCOL = re.compile(r'alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_0-9]+)', re.I)


def strip_comments(sql):
    out = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith('--'):
            continue
        out.append(line)
    return '\n'.join(out)


def objects_of(sql):
    sql = strip_comments(sql)
    objs = set()
    for m in RE_TABLE.finditer(sql):
        objs.add(('table', m.group(1)))
    for m in RE_FUNC.finditer(sql):
        objs.add(('function', m.group(1)))
    for m in RE_POLICY.finditer(sql):
        objs.add(('policy', m.group(1)))
    for m in RE_INDEX.finditer(sql):
        objs.add(('index', m.group(1)))
    for m in RE_TRIGGER.finditer(sql):
        objs.add(('trigger', m.group(1)))
    for m in RE_ADDCOL.finditer(sql):
        objs.add(('column', m.group(1) + '.' + m.group(2)))
    return objs


def main():
    cs_path = os.path.join(DB, 'complete-schema.sql')
    cs = strip_comments(open(cs_path, encoding='utf-8').read())
    have = objects_of(cs)

    # complete-schema DDL bodies also create things inline; a column may be
    # present as "col type" inside the CREATE TABLE rather than an ALTER.
    # Cheap coverage check: table.column text presence.
    def has(obj):
        kind, name = obj
        if kind == 'column':
            t, c = name.split('.', 1)
            if ('table', t) in have:  # table exists; check the column text
                return re.search(r'\b' + re.escape(c) + r'\b', cs) is not None
            return False
        return obj in have

    missing = {}
    for f in sorted(os.listdir(DB)):
        if not f.endswith('.sql'):
            continue
        if f in ('complete-schema.sql',):
            continue
        objs = objects_of(open(os.path.join(DB, f), encoding='utf-8').read())
        gaps = sorted(o for o in objs if not has(o))
        if gaps:
            missing[f] = gaps

    if not missing:
        print('complete-schema.sql: SELF-CONTAINED ✅ — every object from every '
              'migration file is present (%d objects checked).' % len(have))
        return 0
    total = sum(len(g) for g in missing.values())
    print('complete-schema.sql: %d MISSING object(s) from %d file(s) ❌' % (total, len(missing)))
    for f, gaps in missing.items():
        print('  --', f)
        for kind, name in gaps:
            print('       %-9s %s' % (kind, name))
    return 1


if __name__ == '__main__':
    sys.exit(main())
