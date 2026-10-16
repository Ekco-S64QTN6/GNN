import os, re
root='/home/ekco/github/GNN'
bad=[]
for f in ['README.md','CLAUDE.md','docs/ROADMAP.md']:
    p=os.path.join(root,f); base=os.path.dirname(p)
    for m in re.finditer(r'\]\(([^)#][^)]*)\)', open(p).read()):
        t=m.group(1)
        if t.startswith(('http://','https://','mailto:')): continue
        target=os.path.normpath(os.path.join(base, t.split('#')[0]))
        if not os.path.exists(target): bad.append((f,t))
print('broken internal links:', len(bad))
for b in bad: print('  ', b[0], '->', b[1])
