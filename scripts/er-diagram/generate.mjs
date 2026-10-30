// Generates the ER diagram (crow's-foot notation) from the real schema, so it can
// never drift from db/schema.sql:
//
//   1. builds a scratch database from db/schema.sql (dropped afterwards);
//   2. reads tables, columns, primary/unique/foreign keys from PostgreSQL's catalog;
//   3. writes Mermaid erDiagram source to docs/diagrams/er-diagram.md;
//   4. renders it with Chrome to docs/diagrams/er-diagram.svg and .png.
//
//   node scripts/er-diagram/generate.mjs        (PostgreSQL on 55432 must be running)
//
// Cardinality comes from the constraints, not from judgement:
//   parent side  "||" when the foreign-key column is NOT NULL (exactly one parent),
//                "|o" when it is nullable (zero or one);
//   child side   "o|" when the foreign-key column is unique on its own (one-to-one),
//                "o{" otherwise (zero or many).

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'docs', 'diagrams')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DB = 'campusos_er_scratch'
const conn = ['-h', process.env.PGHOST || 'localhost', '-p', process.env.PGPORT || '55432', '-U', process.env.PGUSER || 'postgres']

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' })
const query = (sql) => JSON.parse(run('psql', [...conn, '-X', '-At', '-d', DB, '-c', `SELECT coalesce(json_agg(q_row), '[]') FROM (${sql}) q_row`]))

run('dropdb', [...conn, '--if-exists', DB])
run('createdb', [...conn, DB])
let columns, keys, fks
try {
  run('psql', [...conn, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB, '-f', path.join(ROOT, 'db', 'schema.sql')])
  columns = query(`
    SELECT c.table_name AS t, c.column_name AS c, c.udt_name AS type, c.is_nullable = 'YES' AS nullable, c.ordinal_position AS pos
      FROM information_schema.columns c JOIN information_schema.tables tb USING (table_schema, table_name)
     WHERE c.table_schema = 'public' AND tb.table_type = 'BASE TABLE' ORDER BY c.table_name, c.ordinal_position`)
  // Primary keys and single-column unique constraints (a composite unique does not make one column unique).
  keys = query(`
    SELECT rel.relname AS t, con.contype AS kind, array_length(con.conkey, 1) AS width, a.attname AS c
      FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
      JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = ANY (con.conkey)
     WHERE n.nspname = 'public' AND con.contype IN ('p', 'u')`)
  fks = query(`
    SELECT con.conname AS name, child.relname AS child, parent.relname AS parent, array_length(con.conkey, 1) AS width,
           (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = con.conkey[1]) AS c
      FROM pg_constraint con JOIN pg_class child ON child.oid = con.conrelid JOIN pg_class parent ON parent.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
     WHERE n.nspname = 'public' AND con.contype = 'f' ORDER BY child.relname, con.conname`)
} finally {
  run('dropdb', [...conn, '--if-exists', DB])
}

const pk = new Set(keys.filter((k) => k.kind === 'p').map((k) => `${k.t}.${k.c}`))
const pkWidth = new Map(keys.filter((k) => k.kind === 'p').map((k) => [k.t, k.width]))
const uniqueAlone = new Set(keys.filter((k) => k.width === 1).map((k) => `${k.t}.${k.c}`))
const fkCols = new Set(fks.map((f) => `${f.child}.${f.c}`))
const nullable = new Map(columns.map((c) => [`${c.t}.${c.c}`, c.nullable]))

const TYPES = { int2: 'smallint', int4: 'int', int8: 'bigint', varchar: 'varchar', timestamptz: 'timestamptz', bool: 'boolean', _text: 'text_array' }
const tables = [...new Set(columns.map((c) => c.t))]

const lines = ['erDiagram']
for (const t of tables) {
  lines.push(`  ${t} {`)
  for (const col of columns.filter((c) => c.t === t)) {
    const id = `${t}.${col.c}`
    const tags = [pk.has(id) && 'PK', fkCols.has(id) && 'FK', !pk.has(id) && uniqueAlone.has(id) && 'UK'].filter(Boolean)
    lines.push(`    ${TYPES[col.type] ?? col.type} ${col.c}${tags.length ? ` ${tags.join(', ')}` : ''}`)
  }
  lines.push('  }')
}
for (const f of fks) {
  const id = `${f.child}.${f.c}`
  const parentSide = nullable.get(id) ? '|o' : '||'
  const oneToOne = f.width === 1 && (uniqueAlone.has(id) || (pk.has(id) && pkWidth.get(f.child) === 1))
  lines.push(`  ${f.parent} ${parentSide}--${oneToOne ? 'o|' : 'o{'} ${f.child} : "${f.c}"`)
}
const mermaid = lines.join('\n')

mkdirSync(OUT, { recursive: true })
writeFileSync(path.join(OUT, 'er-diagram.md'), `# CampusOS — ER diagram

Crow's-foot notation, **generated** from \`db/schema.sql\` by
\`scripts/er-diagram/generate.mjs\` (do not edit by hand; rerun the script after a
schema change). Rendered copies: \`er-diagram.svg\`, \`er-diagram.png\`.

${tables.length} tables, ${fks.length} foreign keys. \`PK\` primary key, \`FK\` foreign key,
\`UK\` unique on its own. A table with two \`PK\` columns has a composite primary key.
Line ends: \`||\` exactly one, \`|o\` zero or one, \`o{\` zero or many, \`o|\` zero or one
(one-to-one). The label on each line is the foreign-key column.

Views (\`v_venue_utilisation\`, \`v_club_activity\`, \`v_event_attendance\`,
\`v_active_venues\`) are not entities and are not drawn.

\`\`\`mermaid
${mermaid}
\`\`\`
`)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">
<div id="d"></div>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
  mermaid.initialize({ startOnLoad: false, maxTextSize: 200000, theme: 'base',
    er: { layoutDirection: 'TB', entityPadding: 12, fontSize: 14, useMaxWidth: false },
    themeVariables: { fontFamily: 'Inter, Helvetica, Arial, sans-serif', primaryColor: '#E6F0FF', primaryBorderColor: '#005BFF',
      primaryTextColor: '#0F172A', lineColor: '#3730A3', tertiaryColor: '#ffffff', attributeBackgroundColorOdd: '#ffffff',
      attributeBackgroundColorEven: '#F5F8FF' } })
  const { svg } = await mermaid.render('er', ${JSON.stringify(mermaid)})
  document.getElementById('d').innerHTML = svg
  // Heavier relationship lines and labels, so the diagram reads on a projector.
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = '.er.relationshipLine, path.relationshipLine { stroke-width: 2.2px !important; stroke: #3730A3 !important; }'
    + ' .er.relationshipLabel, .relationshipLabel { font-weight: 600; fill: #1E1B4B; }'
  document.querySelector('#d svg').appendChild(style)
  window.done = true
</script>`)
await page.waitForFunction(() => window.done === true, null, { timeout: 60_000 })
const svg = await page.$eval('#d svg', (el) => el.outerHTML)
writeFileSync(path.join(OUT, 'er-diagram.svg'), svg)
const box = await page.$eval('#d svg', (el) => { const r = el.getBoundingClientRect(); return { width: Math.ceil(r.width), height: Math.ceil(r.height) } })
await page.setViewportSize({ width: box.width + 40, height: box.height + 40 })
await page.$eval('#d', (el) => { el.style.padding = '20px' })
await page.locator('#d').screenshot({ path: path.join(OUT, 'er-diagram.png') })
await browser.close()
console.log(`${tables.length} tables, ${fks.length} foreign keys -> docs/diagrams/er-diagram.{md,svg,png} (${box.width}x${box.height})`)
