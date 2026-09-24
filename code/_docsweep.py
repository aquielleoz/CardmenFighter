import re, io, os, glob, subprocess
ROOT='/Users/Shared/repo/CardmenFighter'
doc=io.open(ROOT+'/docs/NEXT-SESSION.md',encoding='utf-8').read()

# the live code surface (not the generated HTML, not node_modules)
src=[]
for f in glob.glob(ROOT+'/code/*.js')+glob.glob(ROOT+'/relay/*.js'):
    if os.path.basename(f).startswith('_'): continue
    src.append(io.open(f,encoding='utf-8',errors='ignore').read())
src.append(io.open(ROOT+'/code/CardmenFighter.template.html',encoding='utf-8',errors='ignore').read())
CODE='\n'.join(src)

# split the BACKLOG into entries by their id line
entries=[]
for m in re.finditer(r'\n- `(needs a repro|root cause found|ready to build|needs a decision|needs a measurement|parked)`\s*·(.*?)`\[id: ([a-z0-9-]+)\]`', doc, re.S):
    entries.append((m.group(3), m.group(1), m.group(2)))
print('BACKLOG entries parsed: %d' % len(entries))

# a plausible code identifier: camelCase or snake, >=5 chars, not a filename/flag
ident=re.compile(r'`([A-Za-z_$][A-Za-z0-9_$]{4,})`')
SKIP=re.compile(r'\.(js|md|html|json|toml)$|^(true|false|null|undefined|needs|closes|files|updates)$')
rows=[]
for eid, tag, body in entries:
    names=set()
    for n in ident.findall(body):
        if SKIP.search(n): continue
        if not re.search(r'[a-z]', n): continue
        names.add(n)
    missing=[n for n in sorted(names) if not re.search(r'\b'+re.escape(n)+r'\b', CODE)]
    if missing: rows.append((eid, tag, missing))
print('\nENTRIES NAMING SYMBOLS THAT NO LONGER EXIST IN CODE:')
if not rows: print('  (none)')
for eid, tag, missing in rows:
    print('  [%s] %-22s -> %s' % (tag, eid, ', '.join(missing[:6])))
