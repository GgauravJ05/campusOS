# Builds docs/diagrams/database-map.html: all 24 tables in five areas, with each table's foreign-key parents
# read from docs/diagrams/er-diagram.md (itself generated from db/schema.sql by generate.mjs). The tag on each
# table (LOOKUP, M:N, RULE...) is written by hand below. Then:  node render.mjs <abs>/docs/diagrams/database-map.html database-map.png database-map.svg
import os, re, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PAPER, INK, MUTED, SOFT, LINK = '#F6F8FD', '#0F172A', '#4C5871', '#617087', '#4338CA'
ACC, ACC_T, ACC_H = '#005BFF', 'rgba(0,91,255,0.05)', 'rgba(0,91,255,0.12)'
MONO, SANS, SERIF = "'Geist Mono', monospace", "'Geist', sans-serif", "'Instrument Serif', serif"

# ---- facts, derived from the generated ER source so they cannot drift ----
md = open(os.path.join(ROOT, 'docs', 'diagrams', 'er-diagram.md')).read()
rels = re.findall(r'^  (\w+) [|o{}]+--[|o{}]+ (\w+) : "(\w+)"', md, re.M)
refs = collections.defaultdict(list); pointed_at = collections.defaultdict(set)
for parent, child, col in rels:
    if parent not in refs[child]: refs[child].append(parent)
    pointed_at[parent].add(child)
tables = re.findall(r'^  (\w+) \{', md, re.M)
assert len(tables) == 24 and len(rels) == 38

# (table, tag, kind)  kind: hub | rule | plain | unused
ZONES = [
 ('01', 'Identity & access',   'who signs in, and as what',        [('users','HUB','hub'),('roles','LOOKUP','plain'),('departments','LOOKUP','plain'),('refresh_tokens','SESSIONS · ROTATING','plain'),('otps','ONE-TIME CODES · HASHED','plain')]),
 ('02', 'Clubs & governance',  'clubs, members, audit, settings',  [('clubs','ENTITY','plain'),('club_members','M:N JUNCTION','plain'),('admin_logs','APPEND-ONLY · TRIGGER','rule'),('system_settings','CONFIG','plain')]),
 ('03', 'Campus & scheduling', 'rooms, equipment, booking requests',[('venues','ENTITY','plain'),('equipment','LOOKUP','plain'),('venue_equipment','M:N · COMPOSITE KEY','plain'),('campus_paths','GRAPH EDGES · COMPOSITE KEY','plain'),('bookings','RULE · EXCLUSION CONSTRAINT','rule')]),
 ('04', 'Events & seats',      'publishing, eligibility, seats',   [('events','HUB','hub'),('event_eligible_departments','M:N · COMPOSITE KEY','plain'),('event_eligible_years','M:N · COMPOSITE KEY','plain'),('event_registrations','RULE · CAPACITY TRIGGER','rule')]),
 ('05', 'After the event',     'attendance, feedback, alerts',     [('attendance','ENTITY','plain'),('event_feedback','JSONB · GIN INDEX','rule'),('event_reminders','ENTITY','plain'),('notifications','ENTITY','plain'),('certificates','NOT USED YET','unused'),('event_materials','NOT USED YET','unused')]),
]
placed = [t for z in ZONES for (t,_,_) in z[3]]
assert sorted(placed) == sorted(tables), set(tables) ^ set(placed)

ZX0, ZW, ZG, ZY, ZH = 40, 224, 20, 40, 476
BW, BH, BG = 200, 60, 8
o = []; add = o.append
for i,(num,title,sub,items) in enumerate(ZONES):
    zx = ZX0 + i*(ZW+ZG)
    add(f'<rect x="{zx}" y="{ZY}" width="{ZW}" height="{ZH}" rx="8" fill="rgba(15,23,42,0.03)" stroke="rgba(15,23,42,0.14)" stroke-width="1"/>')
    add(f'<text x="{zx+16}" y="{ZY+18}" fill="{MUTED}" font-size="8" font-family="{MONO}" letter-spacing="0.18em">{num}</text>')
    add(f'<text x="{zx+16}" y="{ZY+36}" fill="{INK}" font-size="14" font-weight="600" font-family="{SANS}">{title}</text>')
    add(f'<text x="{zx+16}" y="{ZY+52}" fill="{MUTED}" font-size="11" font-family="{SANS}">{sub}</text>')
    for j,(t,tag,kind) in enumerate(items):
        bx, by = zx+12, ZY+64+j*(BH+BG)
        hub = kind == 'hub'
        stroke = ACC if hub else ('rgba(15,23,42,0.30)' if kind == 'unused' else INK)
        dash = ' stroke-dasharray="4,3"' if kind == 'unused' else ''
        fill = ACC_T if hub else ('rgba(15,23,42,0.02)' if kind == 'unused' else '#ffffff')
        add(f'<rect x="{bx}" y="{by}" width="{BW}" height="{BH}" rx="6" fill="{PAPER}"/>')
        add(f'<rect x="{bx}" y="{by}" width="{BW}" height="{BH}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1"{dash}/>')
        tagtxt = f'HUB · REFERENCED BY {len(pointed_at[t])} TABLES' if hub else tag
        tagcol = ACC if hub else (LINK if kind == 'rule' else (SOFT if kind == 'unused' else MUTED))
        add(f'<text x="{bx+10}" y="{by+14}" fill="{tagcol}" font-size="8" font-family="{MONO}" letter-spacing="0.12em">{tagtxt}</text>')
        add(f'<text x="{bx+10}" y="{by+33}" fill="{SOFT if kind == "unused" else INK}" font-size="12" font-weight="600" font-family="{SANS}">{t}</text>')
        r = refs.get(t)
        add(f'<text x="{bx+10}" y="{by+50}" fill="{MUTED}" font-size="10" font-family="{MONO}">{("→ " + ", ".join(r)) if r else "no foreign keys"}</text>')

# ---- three facts under the zones ----
SY = ZY + ZH + 32
def stat(x, big, lines):
    add(f'<text x="{x}" y="{SY+24}" fill="{ACC}" font-size="28" font-family="{SERIF}">{big}</text>')
    for k,l in enumerate(lines):
        add(f'<text x="{x}" y="{SY+46+16*k}" fill="{MUTED}" font-size="11" font-family="{SANS}">{l}</text>')
touch_hub = sorted(t for t in tables if set(refs.get(t, [])) & {'users', 'events'})
print('tables that point at users or events:', len(touch_hub), touch_hub)
stat(40,  '24 tables, 38 foreign keys', ['Third normal form apart from two documented exceptions;', 'four tables use composite primary keys.'])
stat(452, 'Two hub tables',            [f'users is referenced by {len(pointed_at["users"])} tables and events by {len(pointed_at["events"])}.', f'{len(touch_hub)} of the 24 tables point to at least one of the two.'])
stat(864, 'Rules in the database itself', ['41 CHECK constraints, an exclusion constraint against double', 'booking, a capacity trigger, an append-only audit trigger.'])

# ---- legend strip ----
LY = 664
add(f'<line x1="40" y1="{LY}" x2="1240" y2="{LY}" stroke="rgba(15,23,42,0.12)" stroke-width="0.8"/>')
add(f'<text x="40" y="{LY+18}" fill="{MUTED}" font-size="10" font-family="{MONO}" letter-spacing="0.18em">LEGEND</text>')
def key(x, shape, label): add(shape); add(f'<text x="{x+22}" y="{LY+42}" fill="{MUTED}" font-size="11" font-family="{SANS}">{label}</text>')
key(40,  f'<rect x="40" y="{LY+32}" width="16" height="12" rx="2" fill="{ACC_T}" stroke="{ACC}"/>', 'Hub table')
key(140, f'<rect x="140" y="{LY+32}" width="16" height="12" rx="2" fill="#ffffff" stroke="{INK}"/>', 'Table')
add(f'<text x="216" y="{LY+42}" fill="{INK}" font-size="12" font-family="{MONO}" font-weight="600">→</text><text x="234" y="{LY+42}" fill="{MUTED}" font-size="11" font-family="{SANS}">Tables it points to through foreign keys</text>')
add(f'<text x="502" y="{LY+42}" fill="{LINK}" font-size="10" font-family="{MONO}" font-weight="600" letter-spacing="0.08em">RULE</text><text x="536" y="{LY+42}" fill="{MUTED}" font-size="11" font-family="{SANS}">A rule the database itself enforces</text>')
key(760, f'<rect x="760" y="{LY+32}" width="16" height="12" rx="2" fill="rgba(15,23,42,0.02)" stroke="rgba(15,23,42,0.30)" stroke-dasharray="3,2"/>', 'In the schema, not used by the app')
add(f'<text x="1010" y="{LY+42}" fill="{MUTED}" font-size="11" font-family="{SANS}">M:N = many-to-many junction table</text>')

body = '\n        '.join(o)
html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CampusOS · the whole database</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    :root {{ --color-paper: {PAPER}; --color-ink: {INK}; --color-muted: {MUTED};
             --font-sans: 'Geist', system-ui, sans-serif; --font-serif: 'Instrument Serif', serif; --font-mono: 'Geist Mono', ui-monospace, monospace; }}
    body {{ font-family: var(--font-sans); background: var(--color-paper); color: var(--color-ink); min-height: 100vh;
           display: flex; align-items: center; justify-content: center; padding: 3rem 2rem; }}
    .frame {{ max-width: 1280px; width: 100%; }}
    .eyebrow {{ font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-muted); margin-bottom: 0.5rem; }}
    h1 {{ font-family: var(--font-serif); font-size: clamp(1.5rem, 2.4vw + 0.75rem, 2.5rem); font-weight: 400; letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 1.5rem; }}
    svg {{ width: 100%; min-width: 900px; display: block; }}
  </style>
</head>
<body>
  <div class="frame">
    <p class="eyebrow">Database map · CampusOS · all 24 tables</p>
    <h1>The whole database on one page</h1>

    <svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="db-map-title db-map-desc">
      <title id="db-map-title">CampusOS database map, all 24 tables</title>
      <desc id="db-map-desc">All 24 tables of the CampusOS database in five areas: identity and access, clubs and governance, campus and scheduling, events and seats, and after the event. Each table lists the tables it points to; users and events are the two hub tables.</desc>
        <defs></defs>
        <rect width="100%" height="100%" fill="{PAPER}"/>

        {body}
      </svg>
  </div>
</body>
</html>
'''
open(os.path.join(ROOT, 'docs', 'diagrams', 'database-map.html'),'w').write(html)
print('built; hubs:', {t: len(pointed_at[t]) for t in ('users','events')})
