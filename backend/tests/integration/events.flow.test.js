'use strict';

/**
 * Events and RSVP (FR14-FR17) end to end: publishing an approved event,
 * the discovery feed and its filters, seat reservation with eligibility,
 * backing out and recovering the seat, the waitlist, and the organiser's
 * roster - through the real HTTP API against PostgreSQL.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const settingsService = require('../../src/services/settings.service');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

describeWithDb('events and RSVP (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let gaurav; // heads IT Tech Club (IT)
  let clubMember; // in IT Tech Club, but does not run it
  let student; // IT, year 2
  let itDept;
  let csDept;
  const clubs = {};
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const day = (n) => tw.addDays(tw.campusToday(), n);
  /** Tags this run's events so feed searches cannot match an earlier run's. */
  const runTag = `R${Date.now().toString(36)}${process.pid}`;

  /** A private venue per test, so seat limits never collide across suites. */
  async function newVenue(capacity = 100) {
    const res = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Event Hall ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      building: 'Events Block', floor: 1, type: 'SEMINAR_HALL', capacity,
    }).expect(201);
    return res.body.data.id;
  }

  /**
   * A club event with an approved booking, so it is ready to publish.
   * Faculty book directly (FR12), which approves in one step.
   */
  async function approvedEvent({ capacity = 100, attendance = 50, date = day(20), category = 'TECHNICAL', title = 'Hack Night' } = {}) {
    const venueId = await newVenue(capacity);
    const res = await request(app).post('/api/bookings').set(auth(itCoordinator)).send({
      venueId, clubId: clubs['IT Tech Club'], title: `${title} ${runTag}`, category,
      expectedAttendance: attendance, date, startTime: '10:00', endTime: '12:00',
    }).expect(201);
    return { venueId, bookingId: res.body.data.id, eventId: res.body.data.event.id };
  }

  /** An event open to everyone, published with the given seat cap. */
  async function publishedEvent({ maxSeats = 50, ...rest } = {}) {
    const created = await approvedEvent(rest);
    const res = await request(app).post(`/api/events/${created.eventId}/publish`).set(auth(itCoordinator))
      .send({ maxSeats }).expect(200);
    return { ...created, event: res.body.data };
  }

  const rsvp = (session, eventId, body = {}) =>
    request(app).post(`/api/events/${eventId}/registrations`).set(auth(session)).send(body);

  const cancelRsvp = (session, eventId) =>
    request(app).delete(`/api/events/${eventId}/registrations/me`).set(auth(session));

  const seatCount = async (eventId) => {
    const { rows } = await db.query('SELECT booked_seats, max_seats FROM events WHERE event_id = $1', [eventId]);
    return rows[0];
  };

  /** Moves an event (and its booking) into the past, which no API allows. */
  const pushIntoThePast = (eventId) => db.query(
    `UPDATE events SET event_date = CURRENT_DATE - 1 WHERE event_id = $1`, [eventId],
  ).then(() => db.query(
    `UPDATE bookings SET start_at = now() - interval '2 days', end_at = now() - interval '2 days' + interval '2 hours'
      WHERE event_id = $1`, [eventId],
  ));

  const setWaitlist = async (on) => {
    await db.query(
      `UPDATE system_settings SET setting_value = $1 WHERE setting_key = 'rsvp.allow_waitlist'`,
      [on ? 'true' : 'false'],
    );
    settingsService.invalidate(); // direct SQL bypasses the cache's write-invalidation
  };

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, gaurav, clubMember] = await Promise.all([
      live.signIn(app, 'gaurav.principal@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.head.ittech@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.member.a@mmcoe.edu.in'),
    ]);
    student = await live.createVerifiedStudent(app, { fullName: 'Feed Reader' });
    [itDept, csDept] = await Promise.all([live.departmentId('IT'), live.departmentId('CS')]);
    const { rows } = await db.query(`SELECT club_id, club_name FROM clubs WHERE club_name = 'IT Tech Club'`);
    rows.forEach((r) => { clubs[r.club_name] = r.club_id; });
  });

  afterEach(async () => {
    await setWaitlist(false);
  });

  afterAll(async () => {
    await db.closePool();
  });

  // -------------------------------------------------------------------------
  describe('publishing', () => {
    it('publishes an approved event and returns it open for registration', async () => {
      const { eventId } = await approvedEvent();
      const res = await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator))
        .send({ maxSeats: 40, description: 'Bring a laptop' }).expect(200);

      expect(res.body.data).toMatchObject({
        id: eventId, status: 'PUBLISHED', maxSeats: 40, bookedSeats: 0, seatsLeft: 40, isFull: false,
        description: 'Bring a laptop',
      });
      expect(res.body.data.venue).toMatchObject({ name: expect.any(String) });
    });

    it('refuses more seats than the venue holds', async () => {
      const { eventId } = await approvedEvent({ capacity: 30, attendance: 20 });
      const res = await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator))
        .send({ maxSeats: 500 }).expect(422);
      expect(res.body.error.details[0]).toMatchObject({ field: 'maxSeats' });
    });

    it('refuses to publish twice', async () => {
      const { eventId } = await publishedEvent();
      const res = await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator)).send({}).expect(409);
      expect(res.body.error.code).toBe('ALREADY_PUBLISHED');
    });

    it('refuses to publish an event whose booking is still pending', async () => {
      const venueId = await newVenue();
      const pending = await request(app).post('/api/bookings').set(auth(gaurav)).send({
        venueId, clubId: clubs['IT Tech Club'], title: 'Pending Talk', category: 'SEMINAR',
        expectedAttendance: 20, date: day(21), startTime: '14:00', endTime: '16:00',
      }).expect(201);

      const res = await request(app).post(`/api/events/${pending.body.data.event.id}/publish`)
        .set(auth(gaurav)).send({}).expect(409);
      expect(res.body.error.code).toBe('EVENT_NOT_APPROVED');
    });

    it('does not let an unrelated student publish someone elses event', async () => {
      const { eventId } = await approvedEvent();
      await request(app).post(`/api/events/${eventId}/publish`).set(auth(student)).send({}).expect(404);
    });

    it('lets a club member see the event but not publish it', async () => {
      const { eventId } = await approvedEvent({ date: day(23) });
      await request(app).get(`/api/events/${eventId}`).set(auth(clubMember)).expect(200);
      const res = await request(app).post(`/api/events/${eventId}/publish`).set(auth(clubMember)).send({}).expect(403);
      expect(res.body.error.message).toMatch(/organising club/);
    });

    it('refuses an approved event that has no confirmed venue booking', async () => {
      const { rows } = await db.query(
        `INSERT INTO events (club_id, department_id, created_by, title, category, event_scope,
                             event_date, start_time, end_time, status, max_seats)
         VALUES (NULL, (SELECT department_id FROM departments WHERE dept_code = 'IT'),
                 (SELECT user_id FROM users WHERE email = 'gaurav.coordinator.it@mmcoe.edu.in'),
                 'Venueless', 'SEMINAR', 'DEPARTMENT', CURRENT_DATE + 15, '10:00', '12:00', 'APPROVED', 30)
         RETURNING event_id`,
      );
      const res = await request(app).post(`/api/events/${rows[0].event_id}/publish`)
        .set(auth(itCoordinator)).send({}).expect(409);
      expect(res.body.error.code).toBe('NO_VENUE');
    });

    it('publishes a department event that has no organising club', async () => {
      const venueId = await newVenue(80);
      const booking = await request(app).post('/api/bookings').set(auth(itCoordinator)).send({
        venueId, title: `Department Briefing ${runTag}`, category: 'SEMINAR',
        expectedAttendance: 40, date: day(28), startTime: '09:00', endTime: '10:30',
      }).expect(201);

      const res = await request(app).post(`/api/events/${booking.body.data.event.id}/publish`)
        .set(auth(itCoordinator)).send({ maxSeats: 40 }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'PUBLISHED', scope: 'DEPARTMENT', club: null });

      // The broadcast names the department when there is no club to name.
      const { rows } = await db.query(
        `SELECT message FROM notifications WHERE event_id = $1 LIMIT 1`, [booking.body.data.event.id],
      );
      expect(rows[0].message).toMatch(/^The department is hosting/);
    });

    it('refuses an event that has already started', async () => {
      const { eventId } = await approvedEvent({ date: day(25) });
      await pushIntoThePast(eventId);
      const res = await request(app).post(`/api/events/${eventId}/publish`)
        .set(auth(itCoordinator)).send({}).expect(409);
      expect(res.body.error.code).toBe('EVENT_STARTED');
    });

    it('notifies eligible students that a new event is open (FR19 broadcast)', async () => {
      const { eventId } = await publishedEvent();
      const { rows } = await db.query(
        `SELECT category, title FROM notifications WHERE event_id = $1 AND user_id = $2`,
        [eventId, student.user.id],
      );
      expect(rows[0]).toMatchObject({ category: 'EVENT_PUBLISHED' });
    });

    it('limits the broadcast to the departments and years the event allows', async () => {
      const csStudent = await live.createVerifiedStudent(app, { dept: 'CS', fullName: 'Other Dept' });
      const { eventId } = await approvedEvent();
      await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator))
        .send({ maxSeats: 20, eligibleDepartments: [itDept] }).expect(200);

      const { rows } = await db.query(
        'SELECT count(*)::int AS n FROM notifications WHERE event_id = $1 AND user_id = $2',
        [eventId, csStudent.user.id],
      );
      expect(rows[0].n).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('discovery feed (FR14)', () => {
    it('shows published events to any student, soonest first', async () => {
      const later = await publishedEvent({ date: day(45), title: 'Later Event' });
      const sooner = await publishedEvent({ date: day(44), title: 'Sooner Event' });

      const res = await request(app).get('/api/events').query({ q: runTag, from: day(44), to: day(45) })
        .set(auth(student)).expect(200);
      const ids = res.body.data.items.map((e) => e.id);
      expect(ids.indexOf(sooner.eventId)).toBeLessThan(ids.indexOf(later.eventId));
    });

    it('filters by category, club and date range', async () => {
      const cultural = await publishedEvent({ category: 'CULTURAL', date: day(60), title: 'Dance Night' });

      const byCategory = await request(app).get('/api/events')
        .query({ q: runTag, category: 'CULTURAL', from: day(60), to: day(60) }).set(auth(student)).expect(200);
      expect(byCategory.body.data.items.map((e) => e.id)).toContain(cultural.eventId);
      expect(byCategory.body.data.items.every((e) => e.category === 'CULTURAL')).toBe(true);

      const byClub = await request(app).get('/api/events')
        .query({ q: runTag, clubId: clubs['IT Tech Club'], from: day(60), to: day(60) }).set(auth(student)).expect(200);
      expect(byClub.body.data.items.map((e) => e.id)).toContain(cultural.eventId);

      const otherWindow = await request(app).get('/api/events')
        .query({ q: runTag, from: day(61), to: day(62) }).set(auth(student)).expect(200);
      expect(otherWindow.body.data.items.map((e) => e.id)).not.toContain(cultural.eventId);
    });

    it('searches titles', async () => {
      const unique = `Robotics ${runTag}`;
      const { eventId } = await publishedEvent({ title: unique, date: day(70) });
      const res = await request(app).get('/api/events').query({ q: unique }).set(auth(student)).expect(200);
      expect(res.body.data.items.map((e) => e.id)).toEqual([eventId]);
    });

    it('hides an unpublished event from students but shows it to its organiser', async () => {
      const { eventId } = await approvedEvent({ date: day(75), title: 'Not Yet Public' });

      const asStudent = await request(app).get('/api/events').query({ q: runTag, from: day(75), to: day(75) })
        .set(auth(student)).expect(200);
      expect(asStudent.body.data.items.map((e) => e.id)).not.toContain(eventId);
      await request(app).get(`/api/events/${eventId}`).set(auth(student)).expect(404);

      const asOrganiser = await request(app).get('/api/events').query({ q: runTag, from: day(75), to: day(75) })
        .set(auth(itCoordinator)).expect(200);
      expect(asOrganiser.body.data.items.map((e) => e.id)).toContain(eventId);
    });

    it('lists only the events the student is going to with mine=true', async () => {
      const going = await publishedEvent({ date: day(80) });
      const notAttending = await publishedEvent({ date: day(80), title: 'Not Attending' });
      await rsvp(student, going.eventId).expect(201);

      const res = await request(app).get('/api/events').query({ q: runTag, mine: true, from: day(80), to: day(80) })
        .set(auth(student)).expect(200);
      const ids = res.body.data.items.map((e) => e.id);
      expect(ids).toContain(going.eventId);
      expect(ids).not.toContain(notAttending.eventId);
      expect(res.body.data.items.every((e) => e.myRegistration !== null)).toBe(true);
    });

    it('pages', async () => {
      const res = await request(app).get('/api/events').query({ page: 1, pageSize: 2 }).set(auth(student)).expect(200);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.meta).toMatchObject({ page: 1, pageSize: 2 });
    });

    it('rejects an unknown category rather than silently ignoring it', async () => {
      await request(app).get('/api/events').query({ category: 'PARTY' }).set(auth(student)).expect(422);
    });
  });

  // -------------------------------------------------------------------------
  describe('seat reservation (FR15)', () => {
    it('reserves a seat, increments the counter and confirms by email', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10 });
      const res = await rsvp(student, eventId).expect(201);

      expect(res.body.data.event).toMatchObject({ bookedSeats: 1, seatsLeft: 9 });
      expect(res.body.data.event.myRegistration).toMatchObject({ status: 'RESERVED', seats: 1 });
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 1 });
      expect(live.sentMail(student.email).at(-1).subject).toMatch(/seat confirmed/);
    });

    it('refuses to reserve more than one seat', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10 });
      // A student reserves a seat for themselves, not for friends.
      await rsvp(student, eventId, { seats: 3 }).expect(422);
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 0 });
    });

    it('refuses a second registration from the same student', async () => {
      const { eventId } = await publishedEvent();
      await rsvp(student, eventId).expect(201);
      const res = await rsvp(student, eventId).expect(409);
      expect(res.body.error.code).toBe('ALREADY_REGISTERED');
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 1 });
    });

    it('refuses a student from a department the event excludes (FR15)', async () => {
      const { eventId } = await approvedEvent({ date: day(85) });
      await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator))
        .send({ maxSeats: 20, eligibleDepartments: [csDept] }).expect(200);

      const res = await rsvp(student, eventId).expect(403);
      expect(res.body.error.code).toBe('DEPARTMENT_NOT_ELIGIBLE');
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 0 });
    });

    it('refuses a student in an excluded academic year, and says so on the event itself', async () => {
      const { eventId } = await approvedEvent({ date: day(86) });
      await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator))
        .send({ maxSeats: 20, eligibleYears: [4] }).expect(200);

      const detail = await request(app).get(`/api/events/${eventId}`).set(auth(student)).expect(200);
      expect(detail.body.data.eligibility.ineligibleReason).toMatch(/academic year/);
      expect(detail.body.data.permissions.canRegister).toBe(false);

      const res = await rsvp(student, eventId).expect(403);
      expect(res.body.error.code).toBe('YEAR_NOT_ELIGIBLE');
    });

    it('refuses an event that is not published yet', async () => {
      const { eventId } = await approvedEvent({ date: day(87) });
      // The organiser can see it, so this is a real 409 rather than a 404.
      const res = await rsvp(itCoordinator, eventId).expect(409);
      expect(res.body.error.code).toBe('EVENT_NOT_OPEN');
    });

    it('refuses once the event is full, and the counter never exceeds the cap', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 1 });
      await rsvp(student, eventId).expect(201);

      const second = await live.createVerifiedStudent(app, { fullName: 'Too Late' });
      const res = await rsvp(second, eventId).expect(409);
      expect(res.body.error.code).toBe('EVENT_FULL');
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 1, max_seats: 1 });
    });

    it('rejects a seat count outside the allowed range before touching the database', async () => {
      const { eventId } = await publishedEvent();
      await rsvp(student, eventId, { seats: 0 }).expect(422);
      await rsvp(student, eventId, { seats: 2 }).expect(422);
      await rsvp(student, eventId, { seats: 99 }).expect(422);
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 0 });
    });
  });

  // -------------------------------------------------------------------------
  describe('backout and seat recovery (FR16)', () => {
    it('releases the seat atomically when a student backs out', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10 });
      await rsvp(student, eventId).expect(201);
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 1 });

      const res = await cancelRsvp(student, eventId).expect(200);
      expect(res.body.data).toMatchObject({ seatsReleased: 1, promoted: 0 });
      expect(res.body.data.event).toMatchObject({ bookedSeats: 0, seatsLeft: 10, myRegistration: null });
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 0 });
    });

    it('frees the seat for someone else, and lets the same student sign up again', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 1 });
      const other = await live.createVerifiedStudent(app, { fullName: 'Waiting Student' });

      await rsvp(student, eventId).expect(201);
      await rsvp(other, eventId).expect(409);

      await cancelRsvp(student, eventId).expect(200);
      await rsvp(other, eventId).expect(201);

      // The original student is now the one who has to wait.
      await rsvp(student, eventId).expect(409);
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 1 });
    });

    it('lets a student who backed out register again', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10 });
      await rsvp(student, eventId).expect(201);
      await cancelRsvp(student, eventId).expect(200);

      // The (event, student) row is unique, so this reuses it rather than
      // inserting a second one.
      const again = await rsvp(student, eventId).expect(201);
      expect(again.body.data.event).toMatchObject({ bookedSeats: 1 });
      const { rows } = await db.query(
        'SELECT count(*)::int AS n FROM event_registrations WHERE event_id = $1 AND student_id = $2',
        [eventId, student.user.id],
      );
      expect(rows[0].n).toBe(1);
    });

    it('refuses to back out of an event that has already started', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10, date: day(26) });
      await rsvp(student, eventId).expect(201);
      await pushIntoThePast(eventId);

      const res = await cancelRsvp(student, eventId).expect(409);
      expect(res.body.error.code).toBe('EVENT_STARTED');
    });

    it('still renders an event whose booking was cancelled', async () => {
      const { eventId, bookingId } = await publishedEvent({ date: day(28) });
      await request(app).post(`/api/bookings/${bookingId}/cancel`).set(auth(itCoordinator)).send({}).expect(200);

      // With no approved booking left, the event falls back to the display
      // date columns the SRS mandates. Reading that back as a Date rather
      // than YYYY-MM-DD used to produce an Invalid Date and a 500.
      const res = await request(app).get(`/api/events/${eventId}`).set(auth(itCoordinator)).expect(200);
      expect(res.body.data).toMatchObject({ status: 'CANCELLED', date: day(28), venue: null });
      expect(res.body.data.startTime).toBe('10:00');
    });

    it('refuses to cancel a registration that does not exist', async () => {
      const { eventId } = await publishedEvent();
      await cancelRsvp(student, eventId).expect(404);
    });

    it('releases every seat and tells the registrants when the event is cancelled', async () => {
      const { eventId, bookingId } = await publishedEvent({ maxSeats: 10, date: day(90) });
      await rsvp(student, eventId).expect(201);

      await request(app).post(`/api/bookings/${bookingId}/cancel`).set(auth(itCoordinator)).send({}).expect(200);

      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 0 });
      const { rows } = await db.query(
        `SELECT category FROM notifications WHERE event_id = $1 AND user_id = $2 AND category = 'EVENT_CANCELLED'`,
        [eventId, student.user.id],
      );
      expect(rows).toHaveLength(1);
      const { rows: registrations } = await db.query(
        'SELECT status FROM event_registrations WHERE event_id = $1 AND student_id = $2',
        [eventId, student.user.id],
      );
      expect(registrations[0].status).toBe('CANCELLED');
    });
  });

  // -------------------------------------------------------------------------
  describe('waitlist', () => {
    it('joins the waitlist instead of being refused when the setting is on', async () => {
      await setWaitlist(true);
      const { eventId } = await publishedEvent({ maxSeats: 1 });
      const waiter = await live.createVerifiedStudent(app, { fullName: 'Hopeful' });

      await rsvp(student, eventId).expect(201);
      const res = await rsvp(waiter, eventId).expect(201);

      expect(res.body.data.event.myRegistration).toMatchObject({ status: 'WAITLISTED' });
      // A waitlisted place is not a seat.
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 1 });
    });

    it('promotes the first waiter when a seat frees up, and tells them', async () => {
      await setWaitlist(true);
      const { eventId } = await publishedEvent({ maxSeats: 1 });
      const first = await live.createVerifiedStudent(app, { fullName: 'First In Line' });
      const second = await live.createVerifiedStudent(app, { fullName: 'Second In Line' });

      await rsvp(student, eventId).expect(201);
      await rsvp(first, eventId).expect(201);
      await rsvp(second, eventId).expect(201);

      const res = await cancelRsvp(student, eventId).expect(200);
      expect(res.body.data).toMatchObject({ seatsReleased: 1, promoted: 1 });
      expect(await seatCount(eventId)).toMatchObject({ booked_seats: 1 });

      const { rows } = await db.query(
        `SELECT u.full_name, r.status FROM event_registrations r JOIN users u ON u.user_id = r.student_id
          WHERE r.event_id = $1 AND r.status = 'RESERVED'`,
        [eventId],
      );
      expect(rows).toEqual([{ full_name: 'First In Line', status: 'RESERVED' }]);
      expect(live.sentMail(first.email).at(-1).subject).toMatch(/a seat opened up/);
    });

    it('promotes waiters in the order they joined', async () => {
      await setWaitlist(true);
      const { eventId } = await publishedEvent({ maxSeats: 1 });
      const first = await live.createVerifiedStudent(app, { fullName: 'Waited First' });
      const second = await live.createVerifiedStudent(app, { fullName: 'Waited Second' });

      await rsvp(student, eventId).expect(201);
      await rsvp(first, eventId).expect(201);
      await rsvp(second, eventId).expect(201);

      const res = await cancelRsvp(student, eventId).expect(200);
      expect(res.body.data).toMatchObject({ seatsReleased: 1, promoted: 1 });

      const { rows } = await db.query(
        `SELECT u.full_name FROM event_registrations r JOIN users u ON u.user_id = r.student_id
          WHERE r.event_id = $1 AND r.status = 'RESERVED'`,
        [eventId],
      );
      expect(rows).toEqual([{ full_name: 'Waited First' }]);
    });
  });

  // -------------------------------------------------------------------------
  describe('organiser roster and editing', () => {
    it('shows the organiser who is coming, and hides the roster from students', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10 });
      await rsvp(student, eventId).expect(201);

      const res = await request(app).get(`/api/events/${eventId}/registrations`).set(auth(itCoordinator)).expect(200);
      expect(res.body.data.meta).toMatchObject({ total: 1, reserved: 1, waitlisted: 0 });
      expect(res.body.data.items[0].student).toMatchObject({ fullName: 'Feed Reader', email: student.email });

      await request(app).get(`/api/events/${eventId}/registrations`).set(auth(student)).expect(403);
    });

    it('lets the organiser raise the seat cap, but not below what is already taken', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10 });
      const second = await live.createVerifiedStudent(app, { fullName: 'Second Attendee' });
      await rsvp(student, eventId).expect(201);
      await rsvp(second, eventId).expect(201);

      const raised = await request(app).patch(`/api/events/${eventId}`).set(auth(itCoordinator))
        .send({ maxSeats: 20 }).expect(200);
      expect(raised.body.data).toMatchObject({ maxSeats: 20, seatsLeft: 18 });

      // Two seats are taken, so the cap cannot drop to one.
      const lowered = await request(app).patch(`/api/events/${eventId}`).set(auth(itCoordinator))
        .send({ maxSeats: 1 }).expect(409);
      expect(lowered.body.error.code).toBe('SEATS_ALREADY_TAKEN');
    });

    it('will not edit an event that has been cancelled', async () => {
      const { eventId, bookingId } = await publishedEvent({ date: day(27) });
      await request(app).post(`/api/bookings/${bookingId}/cancel`).set(auth(itCoordinator)).send({}).expect(200);

      const res = await request(app).patch(`/api/events/${eventId}`).set(auth(itCoordinator))
        .send({ description: 'too late' }).expect(409);
      expect(res.body.error.code).toBe('EVENT_CLOSED');
    });

    it('edits the RSVP details a student sees', async () => {
      const { eventId } = await publishedEvent({ maxSeats: 10 });
      const res = await request(app).patch(`/api/events/${eventId}`).set(auth(itCoordinator)).send({
        description: 'Now with free pizza',
        category: 'WORKSHOP',
        eligibleYears: [2, 3],
        bannerUrl: 'https://cdn.example.com/banner.png',
      }).expect(200);

      expect(res.body.data).toMatchObject({
        description: 'Now with free pizza', category: 'WORKSHOP', bannerUrl: 'https://cdn.example.com/banner.png',
      });
      expect(res.body.data.eligibility.years).toEqual([2, 3]);
    });

    it('rejects an edit that changes nothing', async () => {
      const { eventId } = await publishedEvent();
      await request(app).patch(`/api/events/${eventId}`).set(auth(itCoordinator)).send({}).expect(422);
    });

    it('will not let a student edit an event', async () => {
      const { eventId } = await publishedEvent();
      await request(app).patch(`/api/events/${eventId}`).set(auth(student)).send({ description: 'mine now' }).expect(403);
    });
  });

  // -------------------------------------------------------------------------
  describe('recommendations (FR17)', () => {
    // Ranking is scored over the soonest 100 upcoming events, and every suite
    // leaves its events behind in the shared database, so on a reused database
    // this test's events can fall outside that window and never be scored.
    // Rather than depend on the database being freshly seeded, the test clears
    // the field first: other upcoming published events are cancelled. That is
    // safe here because every other test creates the events it needs itself.
    it('ranks events in a category the student has registered for above the rest', async () => {
      await db.query(
        `UPDATE events SET status = 'CANCELLED'
          WHERE status = 'PUBLISHED' AND event_date >= CURRENT_DATE`,
      );
      const fan = await live.createVerifiedStudent(app, { fullName: 'Sports Fan' });
      const attended = await publishedEvent({ category: 'SPORTS', date: day(40), title: 'Past Interest' });
      await rsvp(fan, attended.eventId).expect(201);

      const sports = await publishedEvent({ category: 'SPORTS', date: day(44), title: 'More Sports' });
      await publishedEvent({ category: 'PLACEMENT', date: day(42), title: 'Placement Talk' });

      const res = await request(app).get('/api/events/recommended').query({ limit: 20 }).set(auth(fan)).expect(200);
      const items = res.body.data.items;
      expect(res.body.data.basedOnHistory).toBe(true);

      // Scores only ever descend - that ordering is the recommendation.
      const scores = items.map((e) => e.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);

      // Their one registration was a sports event run by this club, so the
      // top of the list is a sports event from that club: 3 (category)
      // + 4 (club) + 2 (department). The placement talk gets the club and
      // department weight only, so it cannot reach the top.
      expect(items[0]).toMatchObject({ category: 'SPORTS', score: 9 });
      expect(items[0].reason).toMatch(/sports/);
      const placement = items.find((e) => e.title.startsWith('Placement Talk'));
      expect(placement.score).toBeLessThan(items[0].score);
      // With the field cleared, the top event is the one this test published.
      expect(items[0].id).toBe(sports.eventId);
    });

    it('never recommends an event the student is already registered for', async () => {
      const { eventId } = await publishedEvent({ date: day(46) });
      await rsvp(student, eventId).expect(201);

      const res = await request(app).get('/api/events/recommended').query({ limit: 20 }).set(auth(student)).expect(200);
      expect(res.body.data.items.map((e) => e.id)).not.toContain(eventId);
    });

    it('never recommends an event the student is not eligible for', async () => {
      const csOnly = await approvedEvent({ date: day(48) });
      await request(app).post(`/api/events/${csOnly.eventId}/publish`).set(auth(itCoordinator))
        .send({ maxSeats: 20, eligibleDepartments: [csDept] }).expect(200);

      const res = await request(app).get('/api/events/recommended').query({ limit: 20 }).set(auth(student)).expect(200);
      expect(res.body.data.items.map((e) => e.id)).not.toContain(csOnly.eventId);
    });

    it('falls back to what is coming up for a student with no history', async () => {
      const newcomer = await live.createVerifiedStudent(app, { fullName: 'Brand New' });
      await publishedEvent({ date: day(50) });

      const res = await request(app).get('/api/events/recommended').set(auth(newcomer)).expect(200);
      expect(res.body.data.basedOnHistory).toBe(false);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      // With no history every reason is a fallback, never a category claim.
      expect(res.body.data.items.every((e) => !/You have registered/.test(e.reason))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('my activity', () => {
    it('lists events I registered for and events I created, tagged by role', async () => {
      const { eventId: attending } = await publishedEvent({ date: day(51), title: 'Attending This' });
      await rsvp(student, attending).expect(201);
      const { eventId: organising } = await publishedEvent({ date: day(52), title: 'Organising This' });

      const asAttendee = await request(app).get('/api/events/my-activity').set(auth(student)).expect(200);
      const attendeeRow = asAttendee.body.data.find((e) => e.id === attending);
      expect(attendeeRow).toMatchObject({ myRole: 'ATTENDEE' });
      expect(asAttendee.body.data.find((e) => e.id === organising)).toBeUndefined();

      const asOrganiser = await request(app).get('/api/events/my-activity').set(auth(itCoordinator)).expect(200);
      expect(asOrganiser.body.data.find((e) => e.id === organising)).toMatchObject({ myRole: 'ORGANISER' });
    });

    it('tags an event both ways when the organiser also holds a seat at their own event', async () => {
      const { eventId } = await publishedEvent({ date: day(53), title: 'Wearing Both Hats' });
      await rsvp(itCoordinator, eventId).expect(201);

      const res = await request(app).get('/api/events/my-activity').set(auth(itCoordinator)).expect(200);
      const roles = res.body.data.filter((e) => e.id === eventId).map((e) => e.myRole).sort();
      expect(roles).toEqual(['ATTENDEE', 'ORGANISER']);
    });
  });

  // -------------------------------------------------------------------------
  describe('related events (self-join), college-level event', () => {
    it('is empty for a published college-level event with no club', async () => {
      const venueId = await newVenue(100);
      const booking = await request(app).post('/api/bookings').set(auth(principal)).send({
        venueId, title: `Principal Address ${runTag}`, category: 'SEMINAR',
        expectedAttendance: 50, date: day(56), startTime: '10:00', endTime: '11:00',
      }).expect(201);
      // A direct faculty booking (FR12) is auto-approved; still needs
      // publishing before a student can see it (RSVP visibility, FR14).
      await request(app).post(`/api/events/${booking.body.data.event.id}/publish`).set(auth(principal))
        .send({ maxSeats: 50 }).expect(200);

      const res = await request(app).get(`/api/events/${booking.body.data.event.id}`).set(auth(student)).expect(200);
      expect(res.body.data.relatedEvents).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('authentication', () => {
    it('requires a signed-in user everywhere', async () => {
      await request(app).get('/api/events').expect(401);
      await request(app).get('/api/events/recommended').expect(401);
      await request(app).post('/api/events/1/registrations').send({}).expect(401);
    });
  });
});
