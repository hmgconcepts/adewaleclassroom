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

    if problems:
        print(f'{len(problems)} DANGLING HANDLER(S) ❌')
        for rel, target, expr in problems:
            print(f'  {rel}: {target}  ←  "{expr}"')
        sys.exit(1)
    print('every inline event handler resolves ✅')


if __name__ == '__main__':
    main()
