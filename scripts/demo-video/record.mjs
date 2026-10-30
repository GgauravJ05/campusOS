// Records the CampusOS demo video: drives the running app in a real browser,
// captures captioned screenshots per scene, speaks the narration with macOS
// `say`, and stitches everything with ffmpeg into one mp4.
//
//   1. a seeded throwaway database + API + web app (see README.md), then: node seed.mjs
//   2. node record.mjs            -> out/CampusOS-demo.mp4
//
// Needs: Google Chrome, ffmpeg, macOS `say`. No sign-in typing is involved: each
// role's window signs in through the same API call the login form makes.

import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE, VIEW, day, launch, signedIn } from './lib.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'out')
const VOICE = process.env.VOICE || 'Aman'
const RATE = process.env.RATE || '170'
// The finished "Web Dev Workshop" that seed.mjs inserts. On a fresh database it is event 8.
const PAST_EVENT = process.env.PAST_EVENT || 8
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const email = (name) => `${name}@mmcoe.edu.in`
const ACCOUNTS = {
  student: email('gaurav.student.a'),
  student2: email('gaurav.student.c'),
  head: email('gaurav.head.ittech'),
  coordinator: email('gaurav.coordinator.it'),
  principal: email('gaurav.principal'),
}

/** Puts a caption bar (and who is signed in) over the page for one screenshot. */
async function overlay(page, caption, who) {
  await page.evaluate(({ caption, who }) => {
    const bar = document.createElement('div')
    bar.id = '__demo_caption'
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:16px 40px 20px;'
      + 'background:linear-gradient(90deg,#0f172a,#0b3a9e);color:#fff;font:600 21px/1.35 Inter,system-ui,sans-serif;'
      + 'display:flex;gap:16px;align-items:center;box-shadow:0 -6px 24px rgb(0 0 0/.25)'
    bar.textContent = caption
    document.body.appendChild(bar)
    if (who) {
      const tag = document.createElement('div')
      tag.id = '__demo_who'
      tag.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:6px 16px;'
        + 'border-radius:999px;background:#6366f1;color:#fff;font:600 14px Inter,system-ui,sans-serif;letter-spacing:.02em;'
        + 'box-shadow:0 4px 14px rgb(99 102 241/.4)'
      tag.textContent = who
      document.body.appendChild(tag)
    }
  }, { caption, who })
}

const removeOverlay = (page) => page.evaluate(() => {
  document.getElementById('__demo_caption')?.remove()
  document.getElementById('__demo_who')?.remove()
})

let frameNo = 0
function makeSnap(scene, who) {
  return async (page, caption) => {
    await page.waitForTimeout(450) // let animations settle
    await overlay(page, caption, who)
    const file = path.join(OUT, `${String(++frameNo).padStart(3, '0')}-${scene}.png`)
    await page.screenshot({ path: file })
    await removeOverlay(page)
    frames.get(scene).push(file)
  }
}

const frames = new Map()

/** A full-screen title or closing card, drawn in the browser so it matches the app's palette. */
async function card(browser, scene, html) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1.5 })
  const page = await context.newPage()
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;height:100vh;display:grid;place-items:center;color:#fff;font-family:Inter,system-ui,sans-serif;
      background:radial-gradient(circle at 15% 20%,rgb(0 91 255/.6),transparent 45%),radial-gradient(circle at 85% 80%,rgb(99 102 241/.5),transparent 40%),#0f172a}
    main{max-width:980px;padding:0 60px}
    h1{font-size:76px;margin:0 0 12px;letter-spacing:-.03em} h1 span{color:#93c5fd}
    h2{font-size:30px;font-weight:500;margin:0 0 28px;color:#cbd5e1;line-height:1.35}
    p{font-size:22px;color:#94a3b8;margin:6px 0} ul{font-size:24px;line-height:1.7;color:#e2e8f0;padding-left:26px}
    b{color:#93c5fd}
  </style><main>${html}</main>`)
  frames.get(scene).push(await shot(page, scene))
  await context.close()
}
async function shot(page, scene) {
  const file = path.join(OUT, `${String(++frameNo).padStart(3, '0')}-${scene}.png`)
  await page.screenshot({ path: file })
  return file
}

// -------------------------------------------------------------------------
// The storyboard: one narration paragraph per scene, and the steps that show it.
// -------------------------------------------------------------------------
const scenes = [
  {
    id: 'title',
    say: 'CampusOS is the smart campus platform for M M C O E, Pune. Clubs request venues, faculty approve them, events go live, and students never miss what matters. In the next few minutes, here is what it does, and which second year subjects it puts to work.',
    run: async (b) => card(b, 'title', `<h1>Campus<span>OS</span></h1><h2>Smart Campus Management Platform<br>MMCOE Pune</h2><p>Team A6 &middot; B25IT304 Project Based Learning</p><p>Second Year IT &middot; A.Y. 2025-26</p>`),
  },
  {
    id: 'public',
    say: 'This public page is built with Bootstrap and jQuery. The filter buttons are jQuery, and the status badge is a raw XML HTTP request asking the API whether it is running. The stylesheet is hand-written CSS with grid, flexbox and media queries.',
    run: async (b) => {
      const page = await (await b.newContext({ viewport: VIEW, deviceScaleFactor: 1.5 })).newPage()
      const snap = makeSnap('public')
      await page.goto(`${BASE}/about/index.html`)
      await page.waitForFunction(() => document.getElementById('api-status')?.textContent.includes('online'))
      await snap(page, 'A public page: Bootstrap layout, hand-written CSS, semantic HTML')
      await page.locator('#feature-filter button[data-audience=faculty]').click()
      await page.locator('#features').scrollIntoViewIfNeeded()
      await page.evaluate(() => document.getElementById('features').scrollIntoView())
      await snap(page, 'jQuery: filtering the features by audience')
      await page.evaluate(() => document.getElementById('status').scrollIntoView())
      await snap(page, 'An XMLHttpRequest to /api/health: the API reports itself online')
      await page.evaluate(() => document.getElementById('contact').scrollIntoView())
      await page.locator('#contact-form [name=name]').fill('Gaurav Jadhav')
      await page.locator('#contact-form [name=email]').fill('gaurav@mmcoe.edu.in')
      await page.locator('#contact-form [name=message]').fill('A message long enough to be valid.')
      await page.locator('#contact-form [name=mobile]').fill('12345')
      await page.locator('#contact-form [name=mobile]').blur()
      await page.evaluate(() => document.querySelector('#contact-form [name=mobile]').scrollIntoView({ block: 'center' }))
      await snap(page, 'Form validation written by hand: a mobile number must be 10 digits starting 6 to 9')
    },
  },
  {
    id: 'login',
    say: 'Everyone signs in with a college email. Passwords are hashed with bcrypt, sign-in attempts are rate limited, and sessions use rotating refresh tokens that are revoked if one is ever reused.',
    run: async (b) => {
      const page = await (await b.newContext({ viewport: VIEW, deviceScaleFactor: 1.5 })).newPage()
      await page.goto(`${BASE}/login`)
      await makeSnap('login')(page, 'Sign in with an @mmcoe.edu.in email: bcrypt, rate limiting, rotating sessions')
    },
  },
  {
    id: 'student',
    say: 'A student sees their own dashboard: the events they are going to, and recommendations based on what they have registered for before, each with the reason why. There is no machine learning here, only their own history.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.student)
      const snap = makeSnap('student', 'Signed in as a student')
      await page.goto(`${BASE}/dashboard`)
      await page.waitForTimeout(900)
      await snap(page, 'A student\'s dashboard')
      await page.goto(`${BASE}/events`)
      await page.waitForTimeout(900)
      await snap(page, 'Events: filters, seats left, and recommendations with the reason for each')
    },
  },
  {
    id: 'seats',
    say: 'Seats are handled like a counting semaphore. Reserving takes a seat, cancelling gives one back, and a database row lock makes sure that twenty students racing for the last seat produce exactly one winner. Here a second student reserves a seat, and then finds the workshop already full.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.student2)
      const snap = makeSnap('seats', 'Signed in as a student')
      await page.goto(`${BASE}/events`)
      await page.getByRole('link', { name: /Tech Fest Kick-off/ }).first().click()
      await page.getByRole('button', { name: /Reserve my seat/ }).waitFor()
      await snap(page, 'An open event: 300 seats, reserve one')
      await page.getByRole('button', { name: /Reserve my seat/ }).click()
      await page.getByText(/^Reserved /).waitFor()
      await snap(page, 'Reserved. The seat count is updated in the database under a row lock')
      await page.goto(`${BASE}/events`)
      await page.getByRole('link', { name: /Robotics Workshop/ }).first().click()
      await page.getByText('Fully booked').first().waitFor()
      await page.getByRole('button', { name: /Reserve my seat/ }).click()
      await page.getByText('This event is fully booked').waitFor()
      await snap(page, 'A full event cannot be oversold: 3 of 3 seats taken, and the request is refused')
    },
  },
  {
    id: 'venues',
    say: 'Venues are laid out floor by floor. Each floor of the academic building belongs to one department, and mixes classrooms, labs and a seminar hall, so each floor is split into those kinds, in room order. The chips at the top jump straight to a floor.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.student)
      const snap = makeSnap('venues', 'Signed in as a student')
      await page.goto(`${BASE}/venues`)
      await page.getByRole('navigation', { name: 'Jump to a floor' }).waitFor()
      await snap(page, 'Venues by floor, with a jump bar')
      await page.getByRole('navigation', { name: 'Jump to a floor' }).getByRole('button', { name: /4th floor/ }).click()
      await page.waitForTimeout(900)
      await snap(page, '4th floor: classrooms AC 401 to 404, labs, and seminar hall MB 405')
      await page.getByRole('navigation', { name: 'Jump to a floor' }).getByRole('button', { name: /Campus/ }).click()
      await page.waitForTimeout(900)
      await snap(page, 'Campus: Atmayog Kuti, entry space, FMCII Hall and the Sports Ground')
    },
  },
  {
    id: 'clubs',
    say: 'Clubs are grouped the same way, under the floor of their department, with the college-level clubs last.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.student)
      const snap = makeSnap('clubs', 'Signed in as a student')
      await page.goto(`${BASE}/clubs`)
      await page.getByRole('navigation', { name: 'Jump to a floor' }).waitFor()
      await snap(page, 'Clubs by department floor')
      await page.getByRole('navigation', { name: 'Jump to a floor' }).getByRole('button', { name: /5th floor/ }).click()
      await page.waitForTimeout(900)
      await snap(page, 'Each floor shows its department, its clubs, their heads and team size')
    },
  },
  {
    id: 'booking',
    say: 'A club head requests a venue. Campus has a single floor, so the picker skips the floor step. The system checks the slot as you type: this time is already taken by the tech fest, and it needs a fifteen minute gap either side, so it suggests the nearest free times. Overlap detection, buffers and the exclusion constraint all come from the same rules.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.head)
      const snap = makeSnap('booking', 'Signed in as a club head')
      await page.goto(`${BASE}/bookings/new`)
      await page.getByRole('button', { name: /Campus/ }).click()
      await snap(page, 'Campus has one floor, so its rooms are listed directly')
      await page.getByRole('button', { name: /FMCII Hall/ }).click()
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByLabel('Date').fill(day(9))
      await page.getByLabel('Starts').selectOption('16:00')
      await page.getByLabel('Ends').selectOption('18:00')
      await page.getByText('Already booked').waitFor()
      await snap(page, 'Already booked: the tech fest holds that slot, with a 15-minute buffer')
      await page.locator('main button', { hasText: /–/ }).first().click()
      await page.getByText('This slot is free').waitFor()
      await snap(page, 'A suggested free time is chosen')
      await page.getByRole('button', { name: /Continue/ }).click()
      await page.getByLabel('Event title').fill('Cultural Night Rehearsal')
      await page.getByLabel('Category').selectOption({ label: 'Cultural' })
      await page.getByLabel('Expected attendance').fill('250')
      await page.getByLabel('Your club').selectOption({ label: 'IT Tech Club' })
      await snap(page, 'Event details, and a summary of the request')
      await page.getByRole('button', { name: /^(Send|Submit|Request)/ }).last().click()
      await page.waitForTimeout(1500)
      await snap(page, 'The request goes to the department coordinator, and the slot shows as pending')
    },
  },
  {
    id: 'approvals',
    say: 'Faculty see every request waiting for their decision. Two clubs have asked for the sports ground at overlapping times. Approving one is decided inside a database lock, so the second can never be approved as well, and the system rejects it automatically with the reason.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.coordinator)
      const snap = makeSnap('approvals', 'Signed in as a department coordinator')
      await page.goto(`${BASE}/bookings`)
      await page.getByText('Inter-department Cricket').waitFor()
      await snap(page, 'Requests that need a decision; two compete for the Sports Ground')
      const row = page.locator('li', { hasText: 'Inter-department Cricket' }).first()
      await row.getByRole('button', { name: 'Approve' }).click()
      await page.waitForTimeout(1200)
      const confirm = page.getByRole('dialog').getByRole('button', { name: /Approve/ })
      if (await confirm.count()) await confirm.first().click()
      // Wait for the list to refresh: the approved request leaves "Needs decision".
      await page.getByText('Inter-department Cricket').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(800)
      await snap(page, 'Approved. The competing request is rejected automatically')
      await page.getByText('Department', { exact: true }).first().click()
      await page.waitForTimeout(900)
      await snap(page, 'The department view: approved, rejected and pending together')
    },
  },
  {
    id: 'organiser',
    say: 'After an event, the organiser sees who was on the guest list, can mark who actually came, and reads the feedback. Feedback is anonymous. The rating is a typed column, and the follow-up answers, which differ for each kind of event, are stored as a JSON document, which is how this project answers the no S Q L part of the database syllabus.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.coordinator)
      const snap = makeSnap('organiser', 'Signed in as a department coordinator')
      await page.goto(`${BASE}/events/${PAST_EVENT}`) // finished events are not in the upcoming feed
      await page.getByText('Who came').waitFor()
      await snap(page, 'A finished event: who was there')
      await page.getByText('anonymous', { exact: false }).first().scrollIntoViewIfNeeded()
      await page.evaluate(() => document.querySelector('section[aria-labelledby], main')?.scrollTo?.(0, 99999))
      await page.mouse.wheel(0, 700)
      await snap(page, 'Feedback for organisers: ratings, answers per question, comments, no names')
    },
  },
  {
    id: 'feedback',
    say: 'And a student who held a seat can leave that feedback once the event has started.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.student)
      const snap = makeSnap('feedback', 'Signed in as a student')
      await page.goto(`${BASE}/events/${PAST_EVENT}`) // finished events are not in the upcoming feed
      await page.getByRole('heading', { name: 'How was it?' }).waitFor()
      await page.getByLabel('5 stars').check({ force: true })
      await page.getByRole('group', { name: 'Were the materials helpful?' }).getByLabel('Yes').check({ force: true })
      await page.getByRole('group', { name: 'Would you come to another one like this?' }).getByLabel('Yes').check({ force: true })
      await page.getByLabel(/Anything else/).fill('Loved the live coding part.')
      await snap(page, 'The questions come from the API and depend on the kind of event')
      await page.getByRole('button', { name: 'Send feedback' }).click()
      await page.getByText('Feedback sent').waitFor()
      await snap(page, 'Sent. Only the organisers see it, and without a name')
    },
  },
  {
    id: 'principal',
    say: 'The principal sees the whole college: venue utilisation, club activity and attendance as reports that can be exported, and an audit trail of every administrative action. The audit table is append-only; a database trigger refuses any attempt to edit or delete a row.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.principal)
      const snap = makeSnap('principal', 'Signed in as the principal')
      await page.goto(`${BASE}/reports`)
      await page.waitForTimeout(1500)
      await snap(page, 'Reports: venue utilisation, club activity and attendance, with CSV and PDF export')
      await page.goto(`${BASE}/admin/audit`)
      await page.waitForTimeout(1200)
      await snap(page, 'Audit trail: every decision recorded, and impossible to edit')
    },
  },
  {
    id: 'dark',
    say: 'The interface follows the operating system\'s light or dark setting, and its colours are one palette, checked for contrast.',
    run: async (b) => {
      const page = await signedIn(b, ACCOUNTS.principal, { dark: true })
      await page.goto(`${BASE}/dashboard`)
      await page.waitForTimeout(1200)
      await makeSnap('dark', 'Signed in as the principal')(page, 'Dark mode, from the same palette')
    },
  },
  {
    id: 'closing',
    say: 'Under the hood, the project is the second year syllabus at work. Hand written data structures such as a heap, a graph, a hash table and an L R U cache. A class hierarchy for roles and a state machine for bookings. Views, triggers, a cursor and J S O N B in PostgreSQL. A counting semaphore, scheduling policies, and a real deadlock found, fixed and proved with a test. And more than twelve hundred automated tests. Thank you.',
    run: async (b) => card(b, 'closing', `<h1>Campus<span>OS</span></h1><h2>The second year syllabus, applied</h2>
      <ul><li><b>DSA</b> heap, graph and Dijkstra, hash table, queue, tree</li><li><b>OOP</b> role hierarchy, booking state machine, reports</li>
      <li><b>DBMS</b> views, triggers, cursor, JSONB, locking</li><li><b>OS</b> semaphore, scheduling, LRU cache, deadlock case study</li>
      <li><b>Web &amp; Network</b> semantic HTML, Bootstrap, jQuery, XHR, HTTP and CORS</li></ul>
      <p>21 of 21 functional requirements &middot; 1,278 automated tests</p>`),
  },
]

// -------------------------------------------------------------------------
const browser = await launch()
for (const scene of scenes) {
  if (ONLY && !ONLY.includes(scene.id)) continue
  frames.set(scene.id, [])
  process.stdout.write(`scene ${scene.id} ... `)
  await scene.run(browser)
  console.log(`${frames.get(scene.id).length} frames`)
}
await browser.close()

// Narration and assembly.
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }))
const clips = []
for (const scene of scenes) {
  const files = frames.get(scene.id)
  if (!files?.length) continue
  const audio = path.join(OUT, `${scene.id}.aiff`)
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', audio, scene.say])
  const narration = seconds(audio)
  const total = narration + 0.8
  const each = total / files.length
  const list = files.map((f) => `file '${f}'\nduration ${each.toFixed(3)}`).join('\n') + `\nfile '${files.at(-1)}'\n`
  const listFile = path.join(OUT, `${scene.id}.txt`)
  writeFileSync(listFile, list)
  const clip = path.join(OUT, `${scene.id}.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', audio,
    '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-r', '30', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium',
    '-af', 'apad', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(3), clip])
  clips.push(clip)
  console.log(`  ${scene.id}: ${narration.toFixed(1)}s narration, ${files.length} frames`)
}
const all = path.join(OUT, 'all.txt')
writeFileSync(all, clips.map((c) => `file '${c}'`).join('\n'))
const final = path.join(OUT, 'CampusOS-demo.mp4')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', all, '-c', 'copy', '-movflags', '+faststart', final])
console.log(`\nDone: ${final} (${seconds(final).toFixed(0)} s)`)
