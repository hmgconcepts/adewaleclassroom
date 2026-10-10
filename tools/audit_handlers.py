#!/usr/bin/env python3
"""
tools/audit_handlers.py — dangling inline event-handler audit (round 17, item 6)

WHY THIS EXISTS
---------------
The admin-data page shipped two buttons wired to `DataTools.backupAll()`
and `DataTools.restore()` — a global that was never defined anywhere
(data-portability.js defines `DataPortability`, a different engine). Both
buttons threw a silent ReferenceError on click. This audit sweeps EVERY
page for the whole class: every inline `onclick="FN(...)"` /
`onchange="FN(...)"` / `onsubmit=...` etc. must resolve to a function that
is (a) defined in one of the page's own <script> blocks, or (b) defined in
one of the local .js files the page loads, or (c) a known browser/CDN
global. Anything else is reported.

Exit 0 = clean, 1 = dangling handlers found.
Run:  python3 tools/audit_handlers.py

ROUND 18 EXTENSIONS
-------------------
The round-18 sweep found two more members of the same bug class that a
static-HTML scan cannot see, and the audit now covers both:
  1. JS-GENERATED handlers — pages build HTML in JavaScript (table
     rows, cards, drawers) with onclick="GD.restore(...)" inside STRING
     literals. A typo there is invisible to the HTML scan. Every .js
     file is now scanned for handler attributes inside strings and each
     is resolved against every name defined in the tree.
  2. BROKEN REFERENCES — every src=/href= of every page (portal root
     AND classdeck/) must point at a file that exists: a renamed asset
     or a typo'd path 404s quietly behind the service worker and looks
     like "the button does nothing".
"""
import os
import re
import sys
import glob

# Repo root: the directory above tools/ by default, or an explicit argument
# (so the audit can be pointed at any tree, e.g. a generated client ZIP).
ROOT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else \
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# globals provided by the browser, by CDN libraries, or by inline arrow
# wrappers around them — not defined in any local file by name.
KNOWN = {
    'event', 'this', 'window', 'document', 'location', 'history', 'navigator',
    'fetch', 'alert', 'confirm', 'prompt', 'print', 'open', 'close', 'focus',
    'blur', 'requestAnimationFrame', 'setTimeout', 'setInterval',
    'clearTimeout', 'clearInterval', 'localStorage', 'sessionStorage',
    'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader',
    'Image', 'Audio', 'IntersectionObserver', 'MutationObserver',
    'ClipboardEvent', 'DragEvent', 'KeyboardEvent', 'MouseEvent',
    'CustomEvent', 'Event', 'getComputedStyle', 'matchMedia', 'crypto',
    'structuredClone', 'queueMicrotask', 'Notification', 'performance',
    # CDN / library globals
    'Chart', 'supabase', 'hljs', 'marked', 'html2canvas', 'jspdf',
    'GoogleSmartCard', 'google', 'grecaptcha',
}

HANDLER_RE = re.compile(r'\bon(?:click|change|submit|input|keyup|keydown|keypress|load|error|blur|focus|toggle|mouseover|mouseout|dblclick|input|reset|search|drag|drop)\s*=\s*"([^"]*)"', re.I)
HANDLER_SQ_RE = re.compile(r"\bon(?:click|change|submit|input|keyup|keydown|keypress|load|error|blur|focus|toggle)\s*=\s*'([^']*)'", re.I)
SCRIPT_SRC_RE = re.compile(r'<script[^>]*\bsrc="([^"]+)"', re.I)
CALL_RE = re.compile(r'^\s*([A-Za-z_$][\w$]*)\s*(?:\.|\()', re.S)

# expressions that look like a call target but are language constructs —
# never a dangling-handler suspect (onclick="if(!confirm(...))return;...")
JS_KEYWORDS = {
    'if', 'else', 'return', 'typeof', 'void', 'new', 'delete', 'do',
    'for', 'while', 'switch', 'catch', 'try', 'function', 'var', 'let',
    'const', 'this', 'event', 'window', 'document', 'navigator', 'location',
    'true', 'false', 'null', 'undefined', 'confirm', 'alert', 'prompt',
}


def local_js_names(paths):
    """Names defined at top level of the given js sources."""
    names = set()
    for p in paths:
        try:
            s = open(p, encoding='utf-8', errors='replace').read()
        except OSError:
            continue
        for m in re.finditer(r'\bfunction\s+([A-Za-z_$][\w$]*)', s):
            names.add(m.group(1))
        for m in re.finditer(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', s):
            names.add(m.group(1))
        for m in re.finditer(r'\bwindow\.([A-Za-z_$][\w$]*)\s*=', s):
            names.add(m.group(1))
        # object-literal methods that pages call as OBJ.fn() are covered by
        # the object name itself; also collect `NAME: {` / `NAME = {` heads.
        for m in re.finditer(r'\b([A-Za-z_$][\w$]*)\s*=\s*\{', s):
            names.add(m.group(1))
    return names


def inline_names(html):
    names = set()
    for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S):
        s = m.group(1)
        for mm in re.finditer(r'\bfunction\s+([A-Za-z_$][\w$]*)', s):
            names.add(mm.group(1))
        for mm in re.finditer(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', s):
            names.add(mm.group(1))
        for mm in re.finditer(r'\bwindow\.([A-Za-z_$][\w$]*)\s*=', s):
            names.add(mm.group(1))
        for mm in re.finditer(r'\b([A-Za-z_$][\w$]*)\s*=\s*(?:function|\()', s):
            names.add(mm.group(1))
    return names


def first_call_target(expr):
    """The first identifier of the first call in the handler expression."""
    expr = expr.strip()
    # unwrap `return FN(...)`
    if expr.startswith('return '):
        expr = expr[7:]
    m = CALL_RE.match(expr)
    if not m:
        return None
    return m.group(1)


def js_generated_handlers():
    """(file, expr) for every onclick=... built inside JS strings —
    table rows, cards, drawers generated at runtime. A typo here is
    invisible to the static HTML scan (the GD.restore class)."""
    out = []
    pat = re.compile(r"on(?:click|change)\s*=\s*\\?[\"']([A-Za-z_$][\w$.]*)\s*\(")
    for p in sorted(glob.glob(os.path.join(ROOT, '**', '*.js'), recursive=True)):
        if os.sep + 'vendor' + os.sep in p or os.sep + 'node_modules' + os.sep in p:
            continue
        s = open(p, encoding='utf-8', errors='replace').read()
        for m in pat.finditer(s):
            target = m.group(1).split('.')[0].strip()
            if target in JS_KEYWORDS:
                continue
            out.append((p, target))
    return out


def all_tree_names():
    """Every top-level name defined anywhere in the tree's js files —
    the resolution pool for JS-generated handlers (they can run on any
    page that loads their file, so the pool is the whole tree)."""
    names = set()
    for p in glob.glob(os.path.join(ROOT, '**', '*.js'), recursive=True):
        if os.sep + 'vendor' + os.sep in p or os.sep + 'node_modules' + os.sep in p:
            continue
        try:
            s = open(p, encoding='utf-8', errors='replace').read()
        except OSError:
            continue
        for mm in re.finditer(r'\bfunction\s+([A-Za-z_$][\w$]*)', s):
            names.add(mm.group(1))
        for mm in re.finditer(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', s):
            names.add(mm.group(1))
        for mm in re.finditer(r'\bwindow\.([A-Za-z_$][\w$]*)\s*=', s):
            names.add(mm.group(1))
        for mm in re.finditer(r'\b([A-Za-z_$][\w$]*)\s*:\s*function', s):
            names.add(mm.group(1))
        for mm in re.finditer(r'\b([A-Za-z_$][\w$]*)\s*=\s*(?:function|\()', s):
            names.add(mm.group(1))
    return names


def broken_references():
    """(page, ref) for every local src=/href= that does not exist on disk —
    a renamed asset or typo'd path 404s quietly behind the service worker
    and looks like 'the button does nothing'. Only the STATIC markup is
    scanned: <script> blocks are stripped first, because JS builds
    hrefs at runtime (href="' + esc(url) + '") and those are not file
    references."""
    out = []
    pages = sorted(glob.glob(os.path.join(ROOT, '*.html')))
    pages += sorted(glob.glob(os.path.join(ROOT, 'classdeck', '*.html')))
    for page in pages:
        s = open(page, encoding='utf-8', errors='replace').read()
        s = re.sub(r'<script[\s\S]*?</script>', '', s)
        s = re.sub(r'<!--[\s\S]*?-->', '', s)
        rel = os.path.relpath(page, ROOT)
        for m in re.findall(r'(?:src|href)="([^"#?]+?)(?:\?[^"]*)?"', s):
            if m.startswith(('http', '//', 'data:', 'mailto:', 'tel:', 'javascript:')):
                continue
            p = os.path.normpath(os.path.join(os.path.dirname(page), m))
            if not os.path.exists(p):
                out.append((rel, m))
    return out


def main():
    pages = sorted(glob.glob(os.path.join(ROOT, '*.html')))
    problems = []
    for page in pages:
        rel = os.path.relpath(page, ROOT)
        html = open(page, encoding='utf-8', errors='replace').read()
        srcs = SCRIPT_SRC_RE.findall(html)
        local_paths = []
        for s in srcs:
            if s.startswith('http') or s.startswith('//'):
                continue
            local_paths.append(os.path.normpath(os.path.join(ROOT, s.split('?')[0])))
        known = set(KNOWN) | local_js_names(local_paths) | inline_names(html)
        handlers = HANDLER_RE.findall(html) + HANDLER_SQ_RE.findall(html)
        seen = set()
        for expr in handlers:
            target = first_call_target(expr)
            if not target or target in seen:
                continue
            seen.add(target)
            if target not in known:
                problems.append((rel, target, expr.strip()[:80]))

    # ── round 18, extension 1: JS-generated inline handlers ──
    tree_names = all_tree_names() | set(KNOWN)
    js_problems = []
    for p, target in js_generated_handlers():
        if target not in tree_names:
            js_problems.append((os.path.relpath(p, ROOT), target, ''))

    # ── round 18, extension 2: broken asset references ──
    refs = broken_references()

    if problems or js_problems or refs:
        print(f'{len(problems)} DANGLING HANDLER(S) ❌')
        for rel, target, expr in problems:
            print(f'  {rel}: {target}  ←  "{expr}"')
        print(f'{len(js_problems)} DANGLING JS-GENERATED HANDLER(S) ❌')
        for rel, target, _ in js_problems:
            print(f'  {rel}: {target}')
        print(f'{len(refs)} BROKEN REFERENCE(S) ❌')
        for rel, m in refs:
            print(f'  {rel}: → {m}')
        sys.exit(1)
    print('every inline event handler resolves ✅')
    print('every JS-generated handler resolves ✅')
    print('every page asset reference exists ✅')


if __name__ == '__main__':
    main()
