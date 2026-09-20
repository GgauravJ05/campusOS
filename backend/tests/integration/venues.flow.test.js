'use strict';

/**
 * Venue directory, management and availability (FR6, FR7) against PostgreSQL.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');

const { request, db, describeWithDb } = live;

describeWithDb('venues (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  let student;
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, csCoordinator] = await Promise.all([
      live.signIn(app, 'gaurav.principal@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.coordinator.cs@mmcoe.edu.in'),
    ]);
    student = await live.signIn(app, 'gaurav.student.a@mmcoe.edu.in');
  });

  afterAll(async () => {
    await db.closePool();
  });

  const uniqueName = (label) => `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  describe('directory search (FR6)', () => {
    it('lists active venues for any signed-in user, with the effective buffer', async () => {
      const res = await request(app).get('/api/venues?pageSize=100').set(auth(student)).expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(13);
      expect(res.body.data.every((v) => v.isActive)).toBe(true);

      // Searched by name rather than picked out of the first page: other
      // suites add venues, and a paged list is not a stable place to look.
      const named = await request(app).get('/api/venues?q=Main%20Auditorium').set(auth(student)).expect(200);
      expect(named.body.data.find((v) => v.name === 'Main Auditorium')).toMatchObject({
        building: 'Main Building', floor: 0, type: 'AUDITORIUM', capacity: 500, bufferMinutes: 15, canManage: false,
      });
    });

    it('filters by building and floor', async () => {
      // Floor 4 of the academic building is Information Technology.
      const res = await request(app).get('/api/venues?building=Academic%20Building&floor=4').set(auth(student)).expect(200);
      // Every floor has classrooms AC x01-x04; floor 4 also has the MB rooms the IT department named.
      expect(res.body.data.map((v) => v.name).sort()).toEqual([
        'AC 401', 'AC 402', 'AC 403', 'AC 404', 'MB 405', 'MB 407', 'MB 408', 'MB 409', 'MB 411', 'MB 413', 'MB 414',
      ]);
    });

    it('filters by minimum capacity and type', async () => {
      const res = await request(app).get('/api/venues?minCapacity=150&type=SEMINAR_HALL').set(auth(student)).expect(200);
      // Other suites create venues in the shared database, so assert what the
      // filter means rather than that these two are the only matches: both
      // seeded halls are found, and nothing that does not qualify is.
      expect(res.body.data.map((v) => v.name)).toEqual(expect.arrayContaining(['MB 405', 'Seminar Hall B']));
      expect(res.body.data.every((v) => v.type === 'SEMINAR_HALL' && v.capacity >= 150)).toBe(true);
      expect(res.body.data.map((v) => v.name)).not.toContain('AC 101'); // 70 seats, wrong type
    });

    it('requires every requested piece of equipment', async () => {
      const res = await request(app).get('/api/venues?equipment=projector,ac').set(auth(student)).expect(200);
      const names = res.body.data.map((v) => v.name);
      expect(names).toEqual(expect.arrayContaining(['Main Auditorium', 'MB 405', 'MB 407']));
      // The networking lab has desktops and routers, but no projector.
      expect(names).not.toContain('MB 408');
    });

    it('searches name, building and location, treating wildcards literally', async () => {
      const hit = await request(app).get('/api/venues?q=MB%204').set(auth(student)).expect(200);
      expect(hit.body.data.length).toBeGreaterThanOrEqual(2);
      const wildcard = await request(app).get('/api/venues?q=%25').set(auth(student)).expect(200);
      expect(wildcard.body.data).toHaveLength(0);
    });

    it('rejects an unknown venue type', async () => {
      await request(app).get('/api/venues?type=SPACESHIP').set(auth(student)).expect(422);
    });

    it('serves the Building -> Floor -> Venue hierarchy and filter vocabularies', async () => {
      const res = await request(app).get('/api/venues/meta').set(auth(student)).expect(200);

      const academic = res.body.data.buildings.find((b) => b.name === 'Academic Building');
      // One floor per department, 1 to 6. A superset check: other suites add venues.
      expect(academic.floors.map((f) => f.floor)).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
      expect(academic.floors.map((f) => f.floor)).toEqual([...academic.floors.map((f) => f.floor)].sort((a, b) => a - b));
      const itFloor = academic.floors.find((f) => f.floor === 4);
      expect(itFloor.venues.map((v) => v.name)).toEqual(expect.arrayContaining(['MB 407', 'MB 408']));
      expect(res.body.data.equipment).toContain('PROJECTOR');
      // Counts come from a postorder walk of the tree: each node's is the sum of its children's.
      for (const building of res.body.data.buildings) {
        expect(building.venueCount).toBe(building.floors.reduce((sum, f) => sum + f.venues.length, 0));
        for (const floor of building.floors) expect(floor.venueCount).toBe(floor.venues.length);
      }
      const total = res.body.data.buildings.reduce((sum, b) => sum + b.venueCount, 0);
      expect(total).toBeGreaterThanOrEqual(22);
      expect(res.body.data.rules).toMatchObject({ defaultBufferMinutes: 15, openingTime: '07:00', closingTime: '21:00' });
    });

    it('requires sign-in', async () => {
      await request(app).get('/api/venues').expect(401);
    });
  });

  describe('management', () => {
    it('lets a coordinator add a venue, always to their own department, audited', async () => {
      const name = uniqueName('IT Innovation Lab');
      const res = await request(app).post('/api/venues').set(auth(itCoordinator)).send({
        name, building: 'IT Block', floor: 4, type: 'LABORATORY', capacity: 40,
        equipment: ['projector', 'smart board', 'PROJECTOR'], departmentId: 999,
      }).expect(201);

      expect(res.body.data).toMatchObject({
        name, department: { code: 'IT' }, equipment: ['PROJECTOR', 'SMART_BOARD'], bufferMinutes: 15, canManage: true,
      });
      const { rows } = await db.query(`SELECT action FROM admin_logs WHERE target_type = 'VENUE' AND target_id = $1`, [res.body.data.id]);
      expect(rows.map((r) => r.action)).toEqual(['VENUE_CREATED']);
    });

    it('validates new venues', async () => {
      const res = await request(app).post('/api/venues').set(auth(itCoordinator)).send({ name: 'X', capacity: 0, type: 'CAVE' });
      expect(res.status).toBe(422);
      expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'building', 'floor', 'type', 'capacity']));
    });

    it('is closed to students and club heads', async () => {
      const head = await live.signIn(app, 'gaurav.head.ittech@mmcoe.edu.in');
      await request(app).post('/api/venues').set(auth(head)).send({}).expect(403);
      await request(app).post('/api/venues').set(auth(student)).send({}).expect(403);
    });

    it('stops a coordinator editing another department\'s venue', async () => {
      const { rows: [lab] } = await db.query(`SELECT venue_id FROM venues WHERE venue_name = 'MB 407'`);
      const res = await request(app).patch(`/api/venues/${lab.venue_id}`).set(auth(csCoordinator)).send({ capacity: 10 });
      expect(res.status).toBe(403);
    });

    it('sets a per-venue buffer override and deactivates a venue', async () => {
      const created = await request(app).post('/api/venues').set(auth(principal)).send({
        name: uniqueName('Temp Hall'), building: 'Annexe', floor: 1, type: 'CLASSROOM', capacity: 30,
      }).expect(201);
      const id = created.body.data.id;
      expect(created.body.data.department).toBeNull();

      const tuned = await request(app).patch(`/api/venues/${id}`).set(auth(principal)).send({ bufferMinutes: 30 }).expect(200);
      expect(tuned.body.data).toMatchObject({ bufferMinutes: 30, bufferOverride: 30 });

      await request(app).patch(`/api/venues/${id}`).set(auth(principal)).send({ isActive: false }).expect(200);

      await request(app).get(`/api/venues/${id}`).set(auth(student)).expect(404);
      const faculty = await request(app).get(`/api/venues?includeInactive=true&q=${encodeURIComponent('Temp Hall')}`).set(auth(principal)).expect(200);
      expect(faculty.body.data.some((v) => v.id === id && !v.isActive)).toBe(true);
      const hidden = await request(app).get(`/api/venues?includeInactive=true&q=${encodeURIComponent('Temp Hall')}`).set(auth(student)).expect(200);
      expect(hidden.body.data.some((v) => v.id === id)).toBe(false);
    });

    it('ignores an empty update', async () => {
      const { rows: [lab] } = await db.query(`SELECT venue_id FROM venues WHERE venue_name = 'MB 407'`);
      await request(app).patch(`/api/venues/${lab.venue_id}`).set(auth(itCoordinator)).send({}).expect(200);
    });

    it('replaces a venue\'s equipment with no other field changing, and audits it', async () => {
      const created = await request(app).post('/api/venues').set(auth(principal)).send({
        name: uniqueName('Gear Room'), building: 'Annexe', floor: 1, type: 'CLASSROOM', capacity: 30,
        equipment: ['projector'],
      }).expect(201);
      const id = created.body.data.id;

      const updated = await request(app).patch(`/api/venues/${id}`).set(auth(principal))
        .send({ equipment: ['ac', 'whiteboard'] }).expect(200);
      expect(updated.body.data.equipment).toEqual(['AC', 'WHITEBOARD']);

      const { rows: [log] } = await db.query(
        `SELECT action FROM admin_logs WHERE target_type = 'VENUE' AND target_id = $1 ORDER BY log_id DESC LIMIT 1`,
        [id],
      );
      expect(log.action).toBe('VENUE_UPDATED');
    });

    it('answers 404 for an unknown venue', async () => {
      await request(app).get('/api/venues/99999999').set(auth(student)).expect(404);
      await request(app).patch('/api/venues/99999999').set(auth(principal)).send({ capacity: 5 }).expect(404);
    });
  });

  describe('availability range validation', () => {
    it('rejects a reversed range and a range over 31 days', async () => {
      const { rows: [hall] } = await db.query(`SELECT venue_id FROM venues WHERE venue_name = 'MB 405'`);
      await request(app).get(`/api/venues/${hall.venue_id}/availability?from=2030-02-10&to=2030-02-01`).set(auth(student)).expect(422);
      await request(app).get(`/api/venues/${hall.venue_id}/availability?from=2030-01-01&to=2030-03-01`).set(auth(student)).expect(422);
      await request(app).get(`/api/venues/${hall.venue_id}/availability?from=soon&to=later`).set(auth(student)).expect(422);
    });
  });
});
