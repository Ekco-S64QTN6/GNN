"""Relative links in the tracked Markdown files that point at nothing.

    python3 tools/tests/links.py

Inline code and fenced blocks are skipped: misaki's phoneme markup,
`[word](/phonemes/)`, looks exactly like a link and is not one.
Exits 1 if any link is broken.
"""
import os
import re
import subprocess
import sys

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # repo root
files = subprocess.run(['git', 'ls-files', '*.md'], cwd=root, capture_output=True,
                       text=True, check=True).stdout.split()
bad = []
for f in files:
    p = os.path.join(root, f)
    base = os.path.dirname(p)
    text = open(p, encoding='utf-8').read()
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    text = re.sub(r'`[^`\n]*`', '', text)
    for m in re.finditer(r'\]\(([^)#][^)]*)\)', text):
        t = m.group(1).strip()
        if t.startswith(('http://', 'https://', 'mailto:')):
            continue
        target = os.path.normpath(os.path.join(base, t.split('#')[0]))
        if not os.path.exists(target):
            bad.append((f, t))
print('markdown files: %d, broken internal links: %d' % (len(files), len(bad)))
for b in bad:
    print('  ', b[0], '->', b[1])
sys.exit(1 if bad else 0)
