'use strict';

/**
 * Phase 6 against PostgreSQL: role-tailored dashboards (FR18), the immutable
 * audit trail (FR20), and the analytics exports (FR21) - including
 * attendance marking, which is what FR21's turnout metrics measure.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

describeWithDb('governance and analytics (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  let gaurav; // heads IT Tech Club (IT)
  let student;
  const clubs = {};
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const day = (n) => tw.addDays(tw.campusToday(), n);
  const fixtures = { eventIds: [], venueIds: [] };

  async function newVenue(capacity = 100) {
    const res = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Report Hall ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      building: 'Reports Block', floor: 1, type: 'SEMINAR_HALL', capacity,
    }).expect(201);
    fixtures.venueIds.push(res.body.data.id);
    return res.body.data.id;
  }

  /** An approved, published event with a seat reserved by `student`. */
  async function eventWithAttendee({ date = day(10), title = 'Reported Event', maxSeats = 20 } = {}) {
    const venueId = await newVenue();
    const booking = await request(app).post('/api/bookings').set(auth(itCoordinator)).send({
      venueId, clubId: clubs['IT Tech Club'], title, category: 'TECHNICAL',
      expectedAttendance: maxSeats, date, startTime: '10:00', endTime: '12:00',
    }).expect(201);
    const eventId = booking.body.data.event.id;
    await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator)).send({ maxSeats }).expect(200);
    await request(app).post(`/api/events/${eventId}/registrations`).set(auth(student)).send({}).expect(201);
    fixtures.eventIds.push(eventId);
    return { eventId, bookingId: booking.body.data.id, venueId };
  }

  /** Drags an event into the past so attendance can be marked against it. */
  const pushIntoThePast = (eventId) => db.query(
    `UPDATE events SET event_date = CURRENT_DATE - 1 WHERE event_id = $1`, [eventId],
  ).then(() => db.query(
    `UPDATE bookings SET start_at = now() - interval '2 days', end_at = now() - interval '2 days' + interval '2 hours'
      WHERE event_id = $1`, [eventId],
  ));

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, csCoordinator, gaurav] = await Promise.all([
      live.signIn(app, 'principal@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.cs@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.jadhav@mmcoe.edu.in'),
    ]);
    student = await live.createVerifiedStudent(app, { fullName: 'Report Student' });
    const { rows } = await db.query(`SELECT club_id, club_name FROM clubs WHERE club_name = 'IT Tech Club'`);
    rows.forEach((r) => { clubs[r.club_name] = r.club_id });
  });

  afterAll(async () => {
    await db.closePool();
  });

  // -------------------------------------------------------------------------
  describe('role-tailored dashboards (FR18)', () => {
    it('gives a student their seats and their next events', async () => {
      const { eventId } = await eventWithAttendee({ date: day(11), title: 'Student Dashboard Event' });

      const res = await request(app).get('/api/dashboard').set(auth(student)).expect(200);
      expect(res.body.data.role).toBe('STUDENT');
      const keys = res.body.data.metrics.map((m) => m.key);
      expect(keys).toEqual(['reserved', 'waitlisted', 'attended', 'open']);
      expect(res.body.data.metrics.find((m) => m.key === 'reserved').value).toBeGreaterThanOrEqual(1);

      expect(res.body.data.schedule.title).toBe('Your next events');
      const mine = res.body.data.schedule.items.find((i) => i.eventId === eventId);
      expect(mine).toMatchObject({ title: 'Student Dashboard Event', venue: expect.any(String), startTime: '10:00' });
    });

    it('gives a club head their own club, not the whole college', async () => {
      const res = await request(app).get('/api/dashboard').set(auth(gaurav)).expect(200);
      expect(res.body.data.role).toBe('CLUB_HEAD');
      expect(res.body.data.metrics.map((m) => m.key))
        .toEqual(['published', 'readyToPublish', 'awaitingDecision', 'seatsFilled']);
      expect(res.body.data.schedule.title).toBe("Your club's next events");
    });

    it('gives a coordinator their department and the principal the college', async () => {
      const coordinatorView = await request(app).get('/api/dashboard').set(auth(itCoordinator)).expect(200);
      expect(coordinatorView.body.data.scope).toBe('DEPARTMENT');
      expect(coordinatorView.body.data.metrics.map((m) => m.key))
        .toEqual(['awaitingDecision', 'waitingOnClub', 'published', 'departmentUsers']);
      expect(coordinatorView.body.data.schedule.title).toBe("Your department's next events");

      const principalView = await request(app).get('/api/dashboard').set(auth(principal)).expect(200);
      expect(principalView.body.data.scope).toBe('COLLEGE');
      expect(principalView.body.data.metrics.map((m) => m.key)).toContain('activeUsers');
      expect(principalView.body.data.schedule.title).toBe("What's on across campus");

      // The college view can never be smaller than one department's.
      const accounts = (view) => view.body.data.metrics.at(-1).value;
      expect(accounts(principalView)).toBeGreaterThanOrEqual(accounts(coordinatorView));
    });

    it('gives a club member the student dashboard - same seats, same feed', async () => {
      const member = await live.signIn(app, 'aditya.patil@mmcoe.edu.in');
      const res = await request(app).get('/api/dashboard').set(auth(member)).expect(200);

      expect(res.body.data.role).toBe('CLUB_MEMBER');
      expect(res.body.data.metrics.map((m) => m.key)).toEqual(['reserved', 'waitlisted', 'attended', 'open']);
    });

    it('requires a signed-in user', async () => {
      await request(app).get('/api/dashboard').expect(401);
    });
  });

  // -------------------------------------------------------------------------
  describe('attendance', () => {
    it('marks the roster once the event has happened, and counts the turnout', async () => {
      const { eventId } = await eventWithAttendee({ date: day(12) });
      await pushIntoThePast(eventId);

      const before = await request(app).get(`/api/events/${eventId}/attendance`).set(auth(itCoordinator)).expect(200);
      expect(before.body.data.meta).toMatchObject({ registered: 1, present: 0, unmarked: 1, canMark: true });

      const res = await request(app).post(`/api/events/${eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'PRESENT' }] }).expect(200);

      expect(res.body.data.marked).toBe(1);
      expect(res.body.data.attendance.meta).toMatchObject({ registered: 1, present: 1, unmarked: 0 });
      expect(res.body.data.attendance.items[0]).toMatchObject({ fullName: 'Report Student', status: 'PRESENT' });
    });

    it('lets a correction overwrite an earlier mark', async () => {
      const { eventId } = await eventWithAttendee({ date: day(13) });
      await pushIntoThePast(eventId);

      await request(app).post(`/api/events/${eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'ABSENT' }] }).expect(200);
      const res = await request(app).post(`/api/events/${eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'PRESENT' }] }).expect(200);

      expect(res.body.data.attendance.meta).toMatchObject({ present: 1, absent: 0 });
    });

    it('refuses to mark an event that has not happened yet', async () => {
      const { eventId } = await eventWithAttendee({ date: day(14) });
      const res = await request(app).post(`/api/events/${eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'PRESENT' }] }).expect(409);
      expect(res.body.error.code).toBe('EVENT_NOT_STARTED');
    });

    it('refuses to mark someone who never reserved a seat', async () => {
      const { eventId } = await eventWithAttendee({ date: day(15) });
      await pushIntoThePast(eventId);
      const other = await live.createVerifiedStudent(app, { fullName: 'Never Registered' });

      const res = await request(app).post(`/api/events/${eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: other.user.id, status: 'PRESENT' }] }).expect(422);
      expect(res.body.error.details[0].message).toMatch(/did not reserve a seat/);
    });

    it('is closed to students and to other departments', async () => {
      const { eventId } = await eventWithAttendee({ date: day(16) });
      await pushIntoThePast(eventId);

      // A published event is visible to everyone, so the honest answer is
      // "you can see it, but you may not mark it" - not "no such event".
      await request(app).get(`/api/events/${eventId}/attendance`).set(auth(student)).expect(403);
      await request(app).post(`/api/events/${eventId}/attendance`).set(auth(csCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'PRESENT' }] }).expect(403);
    });

    it('refuses to mark a cancelled event', async () => {
      const { eventId, bookingId } = await eventWithAttendee({ date: day(19) });
      await request(app).post(`/api/bookings/${bookingId}/cancel`).set(auth(itCoordinator)).send({}).expect(200);
      await pushIntoThePast(eventId);

      const res = await request(app).post(`/api/events/${eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'PRESENT' }] }).expect(409);
      expect(res.body.error.code).toBe('EVENT_CANCELLED');
    });

    it('rejects an unknown attendance status', async () => {
      const { eventId } = await eventWithAttendee({ date: day(17) });
      await request(app).post(`/api/events/${eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'MAYBE' }] }).expect(422);
    });
  });

  // -------------------------------------------------------------------------
  describe('audit trail (FR20)', () => {
    it('records a sign-in, with who and from where', async () => {
      await live.signIn(app, 'coordinator.it@mmcoe.edu.in');

      const res = await request(app).get('/api/admin/audit').query({ action: 'USER_LOGIN' }).set(auth(principal)).expect(200);
      const entry = res.body.data.find((e) => e.actor.email === 'coordinator.it@mmcoe.edu.in');
      expect(entry).toMatchObject({ action: 'USER_LOGIN', label: 'Signed in', group: 'ACCESS' });
      expect(entry.actor.role).toBe('DEPT_COORDINATOR');
      expect(entry.at).toEqual(expect.any(String));
    });

    it('records role changes, venue decisions and event approvals', async () => {
      const { eventId } = await eventWithAttendee({ date: day(18) });
      await request(app).patch(`/api/events/${eventId}`).set(auth(itCoordinator)).send({ description: 'Audited edit' }).expect(200);

      const res = await request(app).get('/api/admin/audit').query({ pageSize: 100 }).set(auth(principal)).expect(200);
      const actions = res.body.data.map((e) => e.action);
      // FR20's list: overrides, logins, role modifications, event approvals,
      // venue decisions - all in one trail.
      expect(actions).toEqual(expect.arrayContaining(['USER_LOGIN', 'VENUE_CREATED', 'BOOKING_DIRECT', 'EVENT_PUBLISHED', 'EVENT_UPDATED']));
      expect(res.body.data.every((e) => e.label && e.group)).toBe(true);
    });

    it('filters by group, by actor and by date', async () => {
      const byGroup = await request(app).get('/api/admin/audit').query({ group: 'ACCESS' }).set(auth(principal)).expect(200);
      expect(byGroup.body.data.every((e) => e.group === 'ACCESS')).toBe(true);

      const byActor = await request(app).get('/api/admin/audit').query({ actorId: itCoordinator.user.id }).set(auth(principal)).expect(200);
      expect(byActor.body.data.every((e) => e.actor.id === itCoordinator.user.id)).toBe(true);

      const tomorrow = await request(app).get('/api/admin/audit').query({ from: day(1) }).set(auth(principal)).expect(200);
      expect(tomorrow.body.data).toHaveLength(0);

      const today = await request(app).get('/api/admin/audit').query({ from: day(0), to: day(0) }).set(auth(principal)).expect(200);
      expect(today.body.data.length).toBeGreaterThan(0);
    });

    it('searches by who did it', async () => {
      const res = await request(app).get('/api/admin/audit').query({ q: 'coordinator.it' }).set(auth(principal)).expect(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((e) => e.actor.email.includes('coordinator.it'))).toBe(true);
    });

    it('pages, newest first', async () => {
      const res = await request(app).get('/api/admin/audit').query({ page: 1, pageSize: 5 }).set(auth(principal)).expect(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5 });

      const times = res.body.data.map((e) => new Date(e.at).getTime());
      expect([...times].sort((a, b) => b - a)).toEqual(times);
    });

    it('publishes the action vocabulary so the filters cannot drift', async () => {
      const res = await request(app).get('/api/admin/audit/vocabulary').set(auth(principal)).expect(200);
      expect(res.body.data.groups).toContain('ACCESS');
      expect(res.body.data.actions.find((a) => a.action === 'ROLE_CHANGED')).toMatchObject({ group: 'ROLES' });
    });

    it('is the principal’s alone - it records every sign-in on campus', async () => {
      await request(app).get('/api/admin/audit').set(auth(itCoordinator)).expect(403);
      await request(app).get('/api/admin/audit').set(auth(student)).expect(403);
      await request(app).get('/api/admin/audit').expect(401);
    });

    it('cannot be rewritten, even from SQL', async () => {
      await expect(db.query(`UPDATE admin_logs SET action = 'TAMPERED' WHERE log_id = (SELECT min(log_id) FROM admin_logs)`))
        .rejects.toThrow(/append-only/);
      await expect(db.query('DELETE FROM admin_logs WHERE log_id = (SELECT min(log_id) FROM admin_logs)'))
        .rejects.toThrow(/append-only/);
    });
  });

  // -------------------------------------------------------------------------
  describe('analytics and exports (FR21)', () => {
    it('lists the reports available to the caller', async () => {
      const forPrincipal = await request(app).get('/api/reports').set(auth(principal)).expect(200);
      expect(forPrincipal.body.data.reports.map((r) => r.key))
        .toEqual(['venue-utilisation', 'club-activity', 'attendance', 'audit-trail']);
      expect(forPrincipal.body.data.formats).toEqual(['json', 'csv', 'pdf']);

      // A coordinator has no audit trail, so it is not offered to them.
      const forCoordinator = await request(app).get('/api/reports').set(auth(itCoordinator)).expect(200);
      expect(forCoordinator.body.data.reports.map((r) => r.key)).not.toContain('audit-trail');
    });

    it('reports venue utilisation against bookable hours, not the whole day', async () => {
      const { venueId } = await eventWithAttendee({ date: day(2), title: 'Utilisation Event' });

      const res = await request(app).get('/api/reports/venue-utilisation')
        .query({ from: day(0), to: day(5) }).set(auth(principal)).expect(200);

      const row = res.body.data.rows.find((r) => r.venueId === venueId);
      expect(row).toMatchObject({ bookings: 1, hours: 2 });
      // 6 days x 14 bookable hours (07:00-21:00) = 84, so 2 hours is 2.4%.
      expect(res.body.data.totals).toMatchObject({ openingTime: '07:00', closingTime: '21:00', bookableHoursPerVenue: 84 });
      expect(row.utilisationPercent).toBeCloseTo(2.4, 1);
    });

    it('reports club activity with registrations and seats filled', async () => {
      await eventWithAttendee({ date: day(3), title: 'Club Activity Event' });

      const res = await request(app).get('/api/reports/club-activity')
        .query({ from: day(0), to: day(9) }).set(auth(principal)).expect(200);

      const dsc = res.body.data.rows.find((r) => r.clubId === clubs['IT Tech Club']);
      expect(dsc.events).toBeGreaterThanOrEqual(1);
      expect(dsc.registrations).toBeGreaterThanOrEqual(1);
      expect(dsc.seatsFilled).toBeGreaterThanOrEqual(1);
      expect(res.body.data.totals.clubs).toBeGreaterThan(0);
    });

    it('reports attendance turnout, counting only events that have happened', async () => {
      const past = await eventWithAttendee({ date: day(4), title: 'Turnout Event' });
      await pushIntoThePast(past.eventId);
      await request(app).post(`/api/events/${past.eventId}/attendance`).set(auth(itCoordinator))
        .send({ marks: [{ studentId: student.user.id, status: 'PRESENT' }] }).expect(200);

      const future = await eventWithAttendee({ date: day(5), title: 'Not Yet Happened' });

      const res = await request(app).get('/api/reports/attendance')
        .query({ from: day(-3), to: day(9) }).set(auth(principal)).expect(200);

      const row = res.body.data.rows.find((r) => r.eventId === past.eventId);
      expect(row).toMatchObject({ registered: 1, present: 1, turnoutPercent: 100 });
      // Turnout for an event next week is a guess, not a metric.
      expect(res.body.data.rows.map((r) => r.eventId)).not.toContain(future.eventId);
    });

    it('scopes a coordinator to their own department', async () => {
      const it = await request(app).get('/api/reports/club-activity').query({ from: day(0), to: day(9) })
        .set(auth(itCoordinator)).expect(200);
      const cs = await request(app).get('/api/reports/club-activity').query({ from: day(0), to: day(9) })
        .set(auth(csCoordinator)).expect(200);

      expect(it.body.data.rows.every((r) => r.department === 'IT')).toBe(true);
      expect(cs.body.data.rows.map((r) => r.clubId)).not.toContain(clubs['IT Tech Club']);
    });

    it('exports CSV with a header, a BOM and the declared columns', async () => {
      const res = await request(app).get('/api/reports/venue-utilisation')
        .query({ format: 'csv', from: day(0), to: day(5) }).set(auth(principal)).expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="campusos-venue-utilisation-\d{4}-\d{2}-\d{2}\.csv"/);
      const body = res.text;
      expect(body.charCodeAt(0)).toBe(0xFEFF); // Excel needs the BOM for UTF-8
      expect(body).toContain('Venue,Building,Capacity,Bookings,Hours booked,Utilisation %,Cancelled');
    });

    it('exports a real PDF', async () => {
      const res = await request(app).get('/api/reports/attendance')
        .query({ format: 'pdf', from: day(-3), to: day(9) })
        .set(auth(principal))
        .buffer()
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(/\.pdf"$/);
      expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('exports the audit trail for the principal only', async () => {
      const res = await request(app).get('/api/reports/audit-trail')
        .query({ format: 'csv', group: 'ACCESS' }).set(auth(principal)).expect(200);
      expect(res.text).toContain('When,Who,Role,Action,Subject,IP');

      await request(app).get('/api/reports/audit-trail').set(auth(itCoordinator)).expect(403);
    });

    it('refuses an unknown report or format rather than guessing', async () => {
      await request(app).get('/api/reports/everything').set(auth(principal)).expect(422);
      await request(app).get('/api/reports/attendance').query({ format: 'xlsx' }).set(auth(principal)).expect(422);
      await request(app).get('/api/reports/attendance').query({ from: 'last-week' }).set(auth(principal)).expect(422);
    });

    it('is closed to students and club heads', async () => {
      await request(app).get('/api/reports/venue-utilisation').set(auth(student)).expect(403);
      await request(app).get('/api/reports/venue-utilisation').set(auth(gaurav)).expect(403);
      await request(app).get('/api/reports').expect(401);
    });
  });
});
