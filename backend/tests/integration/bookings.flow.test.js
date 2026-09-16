'use strict';

/**
 * The booking engine end to end (FR7-FR10, FR12 slot lifecycle, FR13
 * rejection reasons) through the real HTTP API against PostgreSQL.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

describeWithDb('venue bookings (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  let gaurav; // heads IT Tech Club (IT)
  let atharva; // heads Envision Club (IT)
  let member; // Aditya, DSC member
  let student;
  const clubs = {};
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });

  /** A campus date `n` days from today, always bookable. */
  const day = (n) => tw.addDays(tw.campusToday(), n);

  async function newVenue(overrides = {}) {
    const res = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Engine Hall ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      building: 'Engine Block', floor: 1, type: 'SEMINAR_HALL', capacity: 120, ...overrides,
    }).expect(201);
    return res.body.data.id;
  }

  const request_ = (session, body) => request(app).post('/api/bookings').set(auth(session)).send({
    title: 'Hack Night', category: 'TECHNICAL', expectedAttendance: 60, ...body,
  });

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, csCoordinator, gaurav, atharva, member, student] = await Promise.all([
      live.signIn(app, 'principal@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.cs@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.jadhav@mmcoe.edu.in'),
      live.signIn(app, 'atharva.desai@mmcoe.edu.in'),
      live.signIn(app, 'aditya.patil@mmcoe.edu.in'),
      live.signIn(app, 'srushti.mane@mmcoe.edu.in'),
    ]);
    const { rows } = await db.query(`SELECT club_id, club_name FROM clubs WHERE club_name IN ('IT Tech Club', 'Envision Club', 'C.O.D.E Club')`);
    rows.forEach((r) => { clubs[r.club_name] = r.club_id; });
  });

  afterAll(async () => {
    await db.closePool();
  });

  describe('live availability check (FR7)', () => {
    it('reports a free slot with the buffer that will apply', async () => {
      const venueId = await newVenue();
      const res = await request(app).post('/api/venues/check-availability').set(auth(gaurav))
        .send({ venueId, date: day(10), startTime: '10:00', endTime: '12:00' }).expect(200);

      expect(res.body.data).toEqual({ available: true, bufferMinutes: 15, competingRequests: 0, conflicts: [], suggestions: [] });
    });

    it('reports a clash with alternatives nearest the requested time', async () => {
      const venueId = await newVenue();
      await request_(itCoordinator, { venueId, date: day(10), startTime: '10:00', endTime: '12:00', title: 'Dept Meeting' }).expect(201);

      const res = await request(app).post('/api/venues/check-availability').set(auth(gaurav))
        .send({ venueId, date: day(10), startTime: '11:00', endTime: '13:00' }).expect(200);

      expect(res.body.data.available).toBe(false);
      expect(res.body.data.conflicts).toEqual([expect.objectContaining({ title: 'Dept Meeting', startTime: '10:00', endTime: '12:00' })]);
      expect(res.body.data.suggestions[0]).toEqual({ startTime: '12:15', endTime: '14:15' });
    });

    it('validates the window before looking anything up', async () => {
      const venueId = await newVenue();
      const res = await request(app).post('/api/venues/check-availability').set(auth(gaurav))
        .send({ venueId, date: day(10), startTime: '06:00', endTime: '06:15' });
      expect(res.status).toBe(422);
      expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['startTime', 'endTime']));
    });
  });

  describe('club requests and the pending state', () => {
    it('creates a PENDING request and a PENDING_APPROVAL event routed to the club department', async () => {
      const venueId = await newVenue();

      const res = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(12), startTime: '14:00', endTime: '16:00' }).expect(201);

      expect(res.body.data).toMatchObject({
        status: 'PENDING', isDirect: false, date: day(12), startTime: '14:00', endTime: '16:00', bufferMinutes: 15,
        event: { title: 'Hack Night', scope: 'CLUB', status: 'PENDING_APPROVAL', expectedAttendance: 60, club: { name: 'IT Tech Club' }, department: { code: 'IT' } },
        permissions: { canDecide: false, canCancel: true },
      });
      const { rows: [row] } = await db.query('SELECT start_at FROM bookings WHERE booking_id = $1', [res.body.data.id]);
      expect(row.start_at.toISOString()).toBe(tw.toInstant(day(12), '14:00').toISOString());
    });

    it('only lets a club head request for a club they lead', async () => {
      const venueId = await newVenue();
      await request_(atharva, { venueId, clubId: clubs['IT Tech Club'], date: day(12), startTime: '10:00', endTime: '11:00' }).expect(403);
      await request_(gaurav, { venueId, date: day(12), startTime: '10:00', endTime: '11:00' }).expect(422);
    });

    it('is closed to club members and students', async () => {
      const venueId = await newVenue();
      await request_(member, { venueId, clubId: clubs['IT Tech Club'], date: day(12), startTime: '10:00', endTime: '11:00' }).expect(403);
      await request_(student, { venueId, date: day(12), startTime: '10:00', endTime: '11:00' }).expect(403);
    });

    it('refuses more people than the venue holds', async () => {
      const venueId = await newVenue({ capacity: 40 });
      const res = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(12), startTime: '10:00', endTime: '11:00', expectedAttendance: 41 });
      expect(res.status).toBe(422);
      expect(res.body.error.details[0]).toMatchObject({ field: 'expectedAttendance', message: expect.stringContaining('holds 40') });
    });

    it('refuses a past, closed-hours or too-far-ahead window', async () => {
      const venueId = await newVenue();
      const base = { venueId, clubId: clubs['IT Tech Club'] };
      await request_(gaurav, { ...base, date: day(-1), startTime: '10:00', endTime: '11:00' }).expect(422);
      await request_(gaurav, { ...base, date: day(5), startTime: '20:30', endTime: '22:00' }).expect(422);
      await request_(gaurav, { ...base, date: day(120), startTime: '10:00', endTime: '11:00' }).expect(422);
    });

    it('allows competing pending requests for the same window (FR12)', async () => {
      const venueId = await newVenue();
      const slot = { venueId, date: day(14), startTime: '10:00', endTime: '12:00' };
      await request_(gaurav, { ...slot, clubId: clubs['IT Tech Club'] }).expect(201);
      await request_(atharva, { ...slot, clubId: clubs['Envision Club'], title: 'Music Jam' }).expect(201);

      const check = await request(app).post('/api/venues/check-availability').set(auth(gaurav)).send(slot).expect(200);
      expect(check.body.data).toMatchObject({ available: true, competingRequests: 2 });
    });

    it('refuses a request for a slot that is already booked, suggesting alternatives', async () => {
      const venueId = await newVenue();
      await request_(itCoordinator, { venueId, date: day(15), startTime: '09:00', endTime: '11:00', title: 'Faculty Review' }).expect(201);

      const res = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(15), startTime: '11:05', endTime: '12:00' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
      expect(res.body.error.details.conflicts[0]).toMatchObject({ title: 'Faculty Review' });
      expect(res.body.error.details.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('buffer enforcement (FR9)', () => {
    it('blocks back-to-back bookings closer than the buffer and allows exactly the buffer', async () => {
      const venueId = await newVenue();
      await request_(itCoordinator, { venueId, date: day(16), startTime: '10:00', endTime: '12:00' }).expect(201);

      await request_(principal, { venueId, date: day(16), startTime: '12:10', endTime: '13:00' }).expect(409);
      await request_(principal, { venueId, date: day(16), startTime: '12:15', endTime: '13:00' }).expect(201);
      await request_(principal, { venueId, date: day(16), startTime: '09:00', endTime: '09:50' }).expect(409);
      await request_(principal, { venueId, date: day(16), startTime: '09:00', endTime: '09:45' }).expect(201);
    });

    it('uses a per-venue buffer override', async () => {
      const venueId = await newVenue({ bufferMinutes: 45 });
      await request_(itCoordinator, { venueId, date: day(17), startTime: '10:00', endTime: '12:00' }).expect(201);
      await request_(itCoordinator, { venueId, date: day(17), startTime: '12:30', endTime: '13:30' }).expect(409);
      await request_(itCoordinator, { venueId, date: day(17), startTime: '12:45', endTime: '13:30' }).expect(201);
    });
  });

  describe('approval: first approved wins (FR10, FR12)', () => {
    it('approves, turns the slot red, auto-rejects overlapping competitors, and audits it', async () => {
      const venueId = await newVenue();
      const slot = { venueId, date: day(20), startTime: '10:00', endTime: '12:00' };
      const winner = await request_(gaurav, { ...slot, clubId: clubs['IT Tech Club'] }).expect(201);
      const loser = await request_(atharva, { ...slot, clubId: clubs['Envision Club'], title: 'Music Jam' }).expect(201);
      const inBuffer = await request_(atharva, { venueId, clubId: clubs['Envision Club'], date: day(20), startTime: '12:05', endTime: '13:00', title: 'Rehearsal' }).expect(201);
      const clear = await request_(atharva, { venueId, clubId: clubs['Envision Club'], date: day(20), startTime: '12:15', endTime: '13:00', title: 'Rehearsal 2' }).expect(201);

      const res = await request(app).post(`/api/bookings/${winner.body.data.id}/approve`).set(auth(itCoordinator)).expect(200);

      expect(res.body.data).toMatchObject({ status: 'APPROVED', decidedBy: { fullName: 'Nishanti Naidu' }, event: { status: 'APPROVED' } });

      const statusOf = async (id) => (await request(app).get(`/api/bookings/${id}`).set(auth(itCoordinator)).expect(200)).body.data;
      expect(await statusOf(loser.body.data.id)).toMatchObject({ status: 'REJECTED', rejectionReason: expect.stringMatching(/approved first/), event: { status: 'REJECTED' } });
      expect((await statusOf(inBuffer.body.data.id)).status).toBe('REJECTED');
      expect((await statusOf(clear.body.data.id)).status).toBe('PENDING');

      const { rows: [log] } = await db.query(`SELECT action, details, booking_id FROM admin_logs WHERE booking_id = $1`, [winner.body.data.id]);
      expect(log).toMatchObject({ action: 'BOOKING_APPROVED' });
      expect(log.details.autoRejected.sort()).toEqual([loser.body.data.id, inBuffer.body.data.id].sort());
    });

    it('gives exactly one winner when 20 competing requests are approved at the same moment', async () => {
      const venueId = await newVenue();
      const slot = { venueId, date: day(21), startTime: '15:00', endTime: '17:00' };
      const ids = [];
      for (let i = 0; i < 20; i += 1) {
        const res = await request_(i % 2 ? gaurav : atharva, {
          ...slot, clubId: i % 2 ? clubs['IT Tech Club'] : clubs['Envision Club'], title: `Race ${i}`,
        }).expect(201);
        ids.push(res.body.data.id);
      }

      // Two different approvers racing, as would happen with a real inbox.
      const results = await Promise.all(ids.map((id, i) =>
        request(app).post(`/api/bookings/${id}/approve`).set(auth(i % 2 ? principal : itCoordinator))));

      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
      results.filter((r) => r.status !== 200).forEach((r) => {
        expect(r.status).toBe(409);
        expect(['BOOKING_NOT_PENDING', 'SLOT_UNAVAILABLE']).toContain(r.body.error.code);
      });

      const { rows } = await db.query(`SELECT status, count(*)::int AS n FROM bookings WHERE venue_id = $1 GROUP BY status`, [venueId]);
      expect(Object.fromEntries(rows.map((r) => [r.status, r.n]))).toEqual({ APPROVED: 1, REJECTED: 19 });
    });

    it('does not let a race between a direct booking and approvals double-book', async () => {
      const venueId = await newVenue();
      const slot = { venueId, date: day(22), startTime: '10:00', endTime: '12:00' };
      const pending = await request_(gaurav, { ...slot, clubId: clubs['IT Tech Club'] }).expect(201);

      const [approval, direct] = await Promise.all([
        request(app).post(`/api/bookings/${pending.body.data.id}/approve`).set(auth(itCoordinator)),
        request_(principal, { ...slot, title: 'Principal Address' }),
      ]);

      // Whichever transaction takes the venue lock first wins; the other sees it.
      const winners = [approval.status === 200, direct.status === 201].filter(Boolean);
      expect(winners).toHaveLength(1);
      expect([approval, direct].find((r) => r.status >= 400).status).toBe(409);
      const { rows: [{ n }] } = await db.query(`SELECT count(*)::int AS n FROM bookings WHERE venue_id = $1 AND status = 'APPROVED'`, [venueId]);
      expect(n).toBe(1);
    });

    it('refuses to approve twice', async () => {
      const venueId = await newVenue();
      const req = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(23), startTime: '10:00', endTime: '11:00' }).expect(201);
      await request(app).post(`/api/bookings/${req.body.data.id}/approve`).set(auth(itCoordinator)).expect(200);
      const again = await request(app).post(`/api/bookings/${req.body.data.id}/approve`).set(auth(itCoordinator));
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('BOOKING_NOT_PENDING');
    });
  });

  describe('routing (FR12)', () => {
    it('routes a department club request to that department\'s coordinator only', async () => {
      const venueId = await newVenue();
      const req = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(25), startTime: '10:00', endTime: '11:00' }).expect(201);

      await request(app).post(`/api/bookings/${req.body.data.id}/approve`).set(auth(csCoordinator)).expect(404);

      const inbox = await request(app).get('/api/bookings?view=decisions&pageSize=100').set(auth(itCoordinator)).expect(200);
      expect(inbox.body.data.map((b) => b.id)).toContain(req.body.data.id);
      const other = await request(app).get('/api/bookings?view=decisions&pageSize=100').set(auth(csCoordinator)).expect(200);
      expect(other.body.data.map((b) => b.id)).not.toContain(req.body.data.id);
    });

    it('routes a college-level club request to the Principal / HOD only', async () => {
      const venueId = await newVenue();
      const { rows: [club] } = await db.query(
        `INSERT INTO clubs (club_name, department_id, club_head_id)
         VALUES ($1, NULL, (SELECT user_id FROM users WHERE email = 'atharva.desai@mmcoe.edu.in')) RETURNING club_id`,
        [`College Fest ${Date.now()}`],
      );
      const req = await request_(atharva, { venueId, clubId: club.club_id, date: day(26), startTime: '10:00', endTime: '11:00' }).expect(201);
      expect(req.body.data.event.department).toBeNull();

      await request(app).post(`/api/bookings/${req.body.data.id}/approve`).set(auth(itCoordinator)).expect(404);
      await request(app).post(`/api/bookings/${req.body.data.id}/approve`).set(auth(principal)).expect(200);
    });
  });

  describe('direct faculty booking (FR12)', () => {
    it('books instantly as a department event, without a club', async () => {
      const venueId = await newVenue();
      const res = await request_(itCoordinator, { venueId, date: day(27), startTime: '10:00', endTime: '11:00', title: 'Board of Studies' }).expect(201);
      expect(res.body.data).toMatchObject({
        status: 'APPROVED', isDirect: true, decidedBy: { fullName: 'Nishanti Naidu' },
        event: { scope: 'DEPARTMENT', club: null, department: { code: 'IT' }, status: 'APPROVED' },
      });
    });

    it('auto-rejects pending requests it overrides', async () => {
      const venueId = await newVenue();
      const pending = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(28), startTime: '10:00', endTime: '12:00' }).expect(201);

      await request_(itCoordinator, { venueId, date: day(28), startTime: '11:00', endTime: '13:00' }).expect(201);

      const after = await request(app).get(`/api/bookings/${pending.body.data.id}`).set(auth(gaurav)).expect(200);
      expect(after.body.data.status).toBe('REJECTED');
    });

    it('keeps college-level direct bookings for the Principal', async () => {
      const venueId = await newVenue();
      await request_(itCoordinator, { venueId, date: day(29), startTime: '10:00', endTime: '11:00', scope: 'COLLEGE' }).expect(403);
      const res = await request_(principal, { venueId, date: day(29), startTime: '10:00', endTime: '11:00', scope: 'COLLEGE', title: 'Convocation' }).expect(201);
      expect(res.body.data.event).toMatchObject({ scope: 'COLLEGE', department: null });
    });

    it('lets a coordinator book for a club in their department but not another', async () => {
      const venueId = await newVenue();
      // C.O.D.E Club belongs to Computer Engineering, not IT.
      await request_(itCoordinator, { venueId, clubId: clubs['C.O.D.E Club'], date: day(30), startTime: '10:00', endTime: '11:00' }).expect(403);
      await request_(itCoordinator, { venueId, clubId: clubs['IT Tech Club'], date: day(30), startTime: '10:00', endTime: '11:00' }).expect(201);
    });
  });

  describe('rejection and cancellation', () => {
    it('requires a recorded reason to reject (FR13)', async () => {
      const venueId = await newVenue();
      const req = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(31), startTime: '10:00', endTime: '11:00' }).expect(201);

      await request(app).post(`/api/bookings/${req.body.data.id}/reject`).set(auth(itCoordinator)).send({ reason: ' ' }).expect(422);

      const res = await request(app).post(`/api/bookings/${req.body.data.id}/reject`).set(auth(itCoordinator))
        .send({ reason: 'Hall reserved for exam invigilation' }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: 'Hall reserved for exam invigilation', event: { status: 'REJECTED' } });

      await request(app).post(`/api/bookings/${req.body.data.id}/reject`).set(auth(itCoordinator)).send({ reason: 'again please' }).expect(409);
    });

    it('frees the slot when an approved booking is cancelled', async () => {
      const venueId = await newVenue();
      const booked = await request_(itCoordinator, { venueId, date: day(32), startTime: '10:00', endTime: '12:00' }).expect(201);
      await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(32), startTime: '10:00', endTime: '12:00' }).expect(409);

      const res = await request(app).post(`/api/bookings/${booked.body.data.id}/cancel`).set(auth(itCoordinator)).expect(200);
      expect(res.body.data).toMatchObject({ status: 'CANCELLED', event: { status: 'CANCELLED' }, permissions: { canCancel: false } });

      await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(32), startTime: '10:00', endTime: '12:00' }).expect(201);
      await request(app).post(`/api/bookings/${booked.body.data.id}/cancel`).set(auth(itCoordinator)).expect(409);
    });

    it('lets the requester cancel their own request but not another club\'s', async () => {
      const venueId = await newVenue();
      const req = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(33), startTime: '10:00', endTime: '11:00' }).expect(201);
      await request(app).post(`/api/bookings/${req.body.data.id}/cancel`).set(auth(atharva)).expect(404);
      await request(app).post(`/api/bookings/${req.body.data.id}/cancel`).set(auth(gaurav)).expect(200);
    });

    it('cannot decide or cancel a booking that has already started', async () => {
      const venueId = await newVenue();
      const req = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(34), startTime: '10:00', endTime: '11:00' }).expect(201);
      await db.query(`UPDATE bookings SET start_at = now() - interval '1 hour', end_at = now() + interval '1 hour' WHERE booking_id = $1`, [req.body.data.id]);

      const approve = await request(app).post(`/api/bookings/${req.body.data.id}/approve`).set(auth(itCoordinator));
      expect(approve.body.error.code).toBe('BOOKING_EXPIRED');
      const cancel = await request(app).post(`/api/bookings/${req.body.data.id}/cancel`).set(auth(gaurav));
      expect(cancel.body.error.code).toBe('BOOKING_STARTED');
    });
  });

  describe('lists and visibility', () => {
    it('shows club members their club\'s bookings and hides them from students', async () => {
      const venueId = await newVenue();
      const req = await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(35), startTime: '10:00', endTime: '11:00' }).expect(201);

      const mine = await request(app).get('/api/bookings?view=mine&pageSize=100').set(auth(member)).expect(200);
      expect(mine.body.data.map((b) => b.id)).toContain(req.body.data.id);
      await request(app).get(`/api/bookings/${req.body.data.id}`).set(auth(member)).expect(200);

      await request(app).get(`/api/bookings/${req.body.data.id}`).set(auth(student)).expect(404);
      const none = await request(app).get('/api/bookings').set(auth(student)).expect(200);
      expect(none.body.data.map((b) => b.id)).not.toContain(req.body.data.id);
      await request(app).get('/api/bookings?view=decisions').set(auth(student)).expect(403);
    });

    it('filters by status, venue and date range, and paginates', async () => {
      const venueId = await newVenue();
      await request_(itCoordinator, { venueId, date: day(36), startTime: '10:00', endTime: '11:00' }).expect(201);
      await request_(itCoordinator, { venueId, date: day(37), startTime: '10:00', endTime: '11:00' }).expect(201);

      const res = await request(app).get(`/api/bookings?view=all&venueId=${venueId}&status=APPROVED&from=${day(36)}&to=${day(36)}`)
        .set(auth(principal)).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);

      const coordinatorAll = await request(app).get(`/api/bookings?view=all&venueId=${venueId}&pageSize=1`).set(auth(itCoordinator)).expect(200);
      expect(coordinatorAll.body.meta).toMatchObject({ total: 2, totalPages: 2, pageSize: 1 });
    });

    it('draws the calendar: booked slots public, competing pending titles hidden from other clubs', async () => {
      const venueId = await newVenue();
      await request_(itCoordinator, { venueId, date: day(40), startTime: '09:00', endTime: '10:00', title: 'Open Lecture' }).expect(201);
      await request_(gaurav, { venueId, clubId: clubs['IT Tech Club'], date: day(40), startTime: '14:00', endTime: '15:00', title: 'Secret Launch' }).expect(201);

      const asStudent = await request(app).get(`/api/venues/${venueId}/availability?from=${day(40)}&to=${day(41)}`).set(auth(student)).expect(200);
      expect(asStudent.body.data.blocks).toEqual([
        expect.objectContaining({ status: 'BOOKED', title: 'Open Lecture', startTime: '09:00', date: day(40), mine: false }),
        expect.objectContaining({ status: 'PENDING', title: null, club: null }),
      ]);

      const asRequester = await request(app).get(`/api/venues/${venueId}/availability?from=${day(40)}&to=${day(40)}`).set(auth(gaurav)).expect(200);
      expect(asRequester.body.data.blocks[1]).toMatchObject({ title: 'Secret Launch', mine: true });
    });

    it('answers 404 for an unknown booking', async () => {
      await request(app).get('/api/bookings/99999999').set(auth(principal)).expect(404);
      await request(app).post('/api/bookings/99999999/approve').set(auth(principal)).expect(404);
    });
  });
});
