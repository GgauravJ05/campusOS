'use strict';

/**
 * Nearest free venue against PostgreSQL: the campus map is a graph, Dijkstra
 * ranks venues by walking distance, and availability reuses the booking rules.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

describeWithDb('nearest free venue (database)', () => {
  let app;
  let itCoordinator;
  let student;
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const day = (n) => tw.addDays(tw.campusToday(), n);

  const nearest = (query) => request(app).get('/api/venues/nearest').query(query).set(auth(student));
  const window = (n) => ({ date: day(n), startTime: '10:00', endTime: '12:00' });

  beforeAll(async () => {
    app = live.createApp();
    [itCoordinator, student] = await Promise.all([
      live.signIn(app, 'gaurav.coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.student.a@mmcoe.edu.in'),
    ]);
  });

  afterAll(async () => {
    await db.closePool();
  });

  it('ranks the venues in your own building first, at 0 metres, tightest fit first', async () => {
    const res = await nearest({ from: 'Academic Building', ...window(60), limit: 6 }).expect(200);
    const { venues } = res.body.data;

    expect(res.body.data).toMatchObject({ from: 'Academic Building', fromIsOnMap: true });
    expect(venues).toHaveLength(6);
    expect(venues.every((v) => v.building === 'Academic Building' && v.walkingMetres === 0 && v.buildingsAway === 0)).toBe(true);
    expect(venues.every((v) => JSON.stringify(v.route) === JSON.stringify(['Academic Building']))).toBe(true);
    const capacities = venues.map((v) => v.capacity);
    expect(capacities).toEqual([...capacities].sort((a, b) => a - b));
  });

  it('takes the shorter route even when the direct path is longer (Dijkstra)', async () => {
    // Campus -> Academic Building is 260 m directly, but 80 + 120 = 200 m through the Admin Block.
    const res = await nearest({ from: 'Campus', ...window(61), type: 'SEMINAR_HALL', minCapacity: 150, limit: 2 }).expect(200);
    const [first, second] = res.body.data.venues;

    expect(first).toMatchObject({ name: 'Seminar Hall B', capacity: 150, walkingMetres: 200 });
    expect(first.route).toEqual(['Campus', 'Admin Block', 'Academic Building']);
    // The shortest walk crosses 2 paths; BFS knows a route crossing only 1 exists (the 260 m direct one).
    // They answer different questions, so they legitimately differ.
    expect(first.buildingsAway).toBe(2);
    expect(first.fewestPathsPossible).toBe(1);
    expect(second).toMatchObject({ name: 'MB 405', capacity: 200, walkingMetres: 200 });
  });

  it('puts a venue in the starting building ahead of one that needs a walk', async () => {
    const res = await nearest({ from: 'Campus', ...window(62), minCapacity: 100, limit: 6 }).expect(200);
    const { venues } = res.body.data;
    // The four spaces on "Campus" itself come first at 0 m, tightest fit first...
    expect(venues.slice(0, 4).map((v) => v.name)).toEqual(['Atmayou Kuti', 'Main Building Entry Space', 'FMCII Hall', 'Sports Ground']);
    expect(venues.slice(0, 4).every((v) => v.walkingMetres === 0 && v.building === 'Campus')).toBe(true);
    // ...and anything that needs a walk comes after, over the shorter Admin Block route.
    expect(venues.slice(4).every((v) => v.walkingMetres === 200 && v.route[1] === 'Admin Block')).toBe(true);
  });

  it('leaves out a venue that is already booked for the window, and includes it for another', async () => {
    // A venue made for this test, so a rerun against the same database never collides with an earlier booking.
    // Floor 9 and 400 seats keep it clear of the other venue tests' assertions.
    const created = await request(app).post('/api/venues').set(auth(itCoordinator)).send({
      name: `Nearest Test Hall ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      building: 'Academic Building', floor: 9, type: 'SEMINAR_HALL', capacity: 400,
    }).expect(201);
    const hallName = created.body.data.name;
    await request(app).post('/api/bookings').set(auth(itCoordinator)).send({
      venueId: created.body.data.id, title: 'Nearest Test Booking', category: 'SEMINAR',
      expectedAttendance: 100, ...window(63),
    }).expect(201);

    const args = { from: 'Campus', type: 'SEMINAR_HALL', minCapacity: 400, limit: 20 };
    const taken = await nearest({ ...args, ...window(63) }).expect(200);
    expect(taken.body.data.venues.map((v) => v.name)).not.toContain(hallName);

    // A window inside the hall's buffer is still taken; a clear one later that day is free.
    const buffered = await nearest({ ...args, date: day(63), startTime: '12:05', endTime: '13:00' }).expect(200);
    expect(buffered.body.data.venues.map((v) => v.name)).not.toContain(hallName);
    const later = await nearest({ ...args, date: day(63), startTime: '14:00', endTime: '15:00' }).expect(200);
    expect(later.body.data.venues.map((v) => v.name)).toContain(hallName);
    const otherDay = await nearest({ ...args, ...window(64) }).expect(200);
    expect(otherDay.body.data.venues.map((v) => v.name)).toContain(hallName);
  });

  it('filters by capacity and type', async () => {
    const res = await nearest({ from: 'Academic Building', ...window(65), type: 'LABORATORY', minCapacity: 50, limit: 20 }).expect(200);
    expect(res.body.data.venues.length).toBeGreaterThan(0);
    expect(res.body.data.venues.every((v) => v.type === 'LABORATORY' && v.capacity >= 50)).toBe(true);
  });

  it('says so when the starting building is not on the map, and still lists venues', async () => {
    const res = await nearest({ from: 'Nowhere Hall', ...window(66), limit: 3 }).expect(200);
    expect(res.body.data).toMatchObject({ from: 'Nowhere Hall', fromIsOnMap: false });
    expect(res.body.data.venues).toHaveLength(3);
    expect(res.body.data.venues.every((v) => v.walkingMetres === null && v.route === null && v.buildingsAway === null && v.fewestPathsPossible === null)).toBe(true);
  });

  it('returns nothing, without error, when no venue is big enough', async () => {
    const res = await nearest({ from: 'Campus', ...window(67), minCapacity: 99999 }).expect(200);
    expect(res.body.data.venues).toEqual([]);
  });

  it('honours the limit', async () => {
    const res = await nearest({ from: 'Campus', ...window(68), limit: 2 }).expect(200);
    expect(res.body.data.venues).toHaveLength(2);
  });

  it('rejects bad input', async () => {
    await nearest({ ...window(69) }).expect(422); // no "from"
    await nearest({ from: 'Campus', date: 'soon', startTime: '10:00', endTime: '12:00' }).expect(422);
    await nearest({ from: 'Campus', date: day(69), startTime: '25:00', endTime: '12:00' }).expect(422);
    await nearest({ from: 'Campus', ...window(69), type: 'SPACESHIP' }).expect(422);
    await nearest({ from: 'Campus', ...window(69), limit: 500 }).expect(422);
    // Passes the format checks but breaks a booking rule: ends before it starts.
    const bad = await nearest({ from: 'Campus', date: day(69), startTime: '12:00', endTime: '10:00' }).expect(422);
    expect(bad.body.error.details.map((d) => d.field)).toContain('endTime');
    // ... or is in the past.
    await nearest({ from: 'Campus', date: day(-3), startTime: '10:00', endTime: '12:00' }).expect(422);
  });

  it('requires sign-in', async () => {
    await request(app).get('/api/venues/nearest').query({ from: 'Campus', ...window(70) }).expect(401);
  });

  describe('the campus_paths table', () => {
    it('stores each path once, in alphabetical order, with a positive length', async () => {
      await expect(db.query(`INSERT INTO campus_paths VALUES ('Admin Block', 'Academic Building', 50)`))
        .rejects.toMatchObject({ code: '23514' });
      await expect(db.query(`INSERT INTO campus_paths VALUES ('Academic Building', 'Admin Block', 61)`))
        .rejects.toMatchObject({ code: '23505' });
      await expect(db.query(`INSERT INTO campus_paths VALUES ('Aaa', 'Bbb', 0)`))
        .rejects.toMatchObject({ code: '23514' });
    });
  });
});
