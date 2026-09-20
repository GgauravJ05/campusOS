// Fills a freshly seeded database with the events, requests and feedback the
// demo video walks through, using the same API the app uses. Point it at a
// throwaway database (see README.md): it creates bookings and events.
//
//   API=http://localhost:5055 DATABASE_URL=postgresql://postgres@localhost:55432/campusos_video node seed.mjs

import { execFileSync } from 'node:child_process'
import { day } from './lib.mjs'

const API = process.env.API || 'http://localhost:5055'
const DB = process.env.DATABASE_URL || 'postgresql://postgres@localhost:55432/campusos_video'
const PASSWORD = 'Campus@123'

async function call(token, method, path, body) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json.error ?? json)}`)
  return json.data
}

const signIn = async (email) => (await call(null, 'POST', '/auth/login', { email, password: PASSWORD })).accessToken
const sql = (text) => execFileSync('psql', [DB, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', text], { encoding: 'utf8' }).trim()

const [principal, coord, head, envision, studentA, studentD, studentB] = await Promise.all([
  'gaurav.principal', 'gaurav.coordinator.it', 'gaurav.head.ittech', 'gaurav.head.envision',
  'gaurav.student.a', 'gaurav.student.d', 'gaurav.student.b',
].map((n) => signIn(`${n}@mmcoe.edu.in`)))

const venues = Object.fromEntries((await call(principal, 'GET', '/venues?pageSize=100')).map((v) => [v.name, v.id]))
const clubs = Object.fromEntries((await call(principal, 'GET', '/clubs')).map((c) => [c.name, c.id]))

/** Faculty book directly (approved in one step); then publish with a seat cap. */
async function publish(token, { venue, club, title, category, date, start, end, seats, attendance }) {
  const booking = await call(token, 'POST', '/bookings', {
    venueId: venues[venue], clubId: clubs[club], title, category, expectedAttendance: attendance ?? seats,
    date, startTime: start, endTime: end,
  })
  await call(token, 'POST', `/events/${booking.event.id}/publish`, { maxSeats: seats })
  return booking.event.id
}

const hack = await publish(coord, { venue: 'MB 407', club: 'IT Tech Club', title: 'Hack Night', category: 'TECHNICAL', date: day(4), start: '10:00', end: '12:00', seats: 40 })
const design = await publish(coord, { venue: 'MB 405', club: 'Envision Club', title: 'Design Talk: Motion and Media', category: 'SEMINAR', date: day(6), start: '14:00', end: '16:00', seats: 120 })
const fest = await publish(coord, { venue: 'FMCII Hall', club: 'IT Tech Club', title: 'Tech Fest Kick-off', category: 'CULTURAL', date: day(9), start: '16:00', end: '18:00', seats: 300 })
const robotics = await publish(coord, { venue: 'MB 409', club: 'IT Tech Club', title: 'Robotics Workshop', category: 'WORKSHOP', date: day(5), start: '11:00', end: '13:00', seats: 3 })

for (const [token, ids] of [[studentA, [hack, design, robotics]], [studentD, [hack, robotics]], [studentB, [hack, robotics]]]) {
  for (const id of ids) await call(token, 'POST', `/events/${id}/registrations`, { seats: 1 })
}

// Two clubs ask for the Sports Ground at overlapping times: the approval screen has something to decide.
const ask = (token, club, title, start, end) => call(token, 'POST', '/bookings', {
  venueId: venues['Sports Ground'], clubId: clubs[club], title, category: 'SPORTS', expectedAttendance: 150,
  date: day(11), startTime: start, endTime: end,
})
await ask(head, 'IT Tech Club', 'Inter-department Cricket', '09:00', '12:00')
await ask(envision, 'Envision Club', 'Photography Walk and Sports Day', '10:00', '13:00')
// A request nobody has touched, in another department's queue.
await call(head, 'POST', '/bookings', {
  venueId: venues['AC 402'], clubId: clubs['IT Tech Club'], title: 'Prompt Engineering Session', category: 'TECHNICAL',
  expectedAttendance: 60, date: day(7), startTime: '15:00', endTime: '17:00',
})

// A finished event with feedback. No API can create an event in the past, so this row is inserted directly.
const pastId = Number(sql(`
  INSERT INTO events (created_by, club_id, title, category, event_date, start_time, end_time, status, max_seats)
  SELECT u.user_id, c.club_id, 'Web Dev Workshop', 'WORKSHOP', current_date - 3, '10:00', '13:00', 'PUBLISHED', 40
    FROM users u, clubs c WHERE u.email = 'gaurav.coordinator.it@mmcoe.edu.in' AND c.club_name = 'IT Tech Club'
  RETURNING event_id`).split('\n')[0])
sql(`INSERT INTO event_registrations (event_id, student_id, status, seats)
     SELECT ${pastId}, user_id, 'RESERVED', 1 FROM users
      WHERE email IN ('gaurav.student.a@mmcoe.edu.in', 'gaurav.student.d@mmcoe.edu.in', 'gaurav.student.b@mmcoe.edu.in')`)
await call(studentD, 'POST', `/events/${pastId}/feedback`, { rating: 5, answers: { materials_helpful: true, would_repeat: true, comment: 'Clear examples and a good pace.' } })
await call(studentB, 'POST', `/events/${pastId}/feedback`, { rating: 4, answers: { materials_helpful: true, would_repeat: true } })

console.log(JSON.stringify({ hack, design, fest, robotics, pastId }))
