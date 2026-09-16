'use strict';

/**
 * The approval workflow (FR13): request modification, edit and resubmit,
 * the approver inbox, badge counts, and the notifications each decision
 * sends - through the real HTTP API against PostgreSQL.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');

const { request, db, describeWithDb } = live;

describeWithDb('approval workflow (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  let gaurav; // heads IT Tech Club (IT)
  let atharva; // heads Envision Club (IT)
  let aditya; // DSC member
  const clubs = {};
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const day = (n) => tw.addDays(tw.campusToday(), n);

  async function newVenue(overrides = {}) {
    const res = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Approval Hall ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      building: 'Approval Block', floor: 1, type: 'SEMINAR_HALL', capacity: 120, ...overrides,
    }).expect(201);
    return res.body.data.id;
  }

  const submit = (session, body) => request(app).post('/api/bookings').set(auth(session)).send({
    title: 'Hack Night', category: 'TECHNICAL', expectedAttendance: 60, ...body,
  });

  async function dscRequest(overrides = {}) {
    const venueId = overrides.venueId ?? await newVenue();
    const res = await submit(gaurav, {
      venueId, clubId: clubs['IT Tech Club'], date: day(30), startTime: '10:00', endTime: '12:00', ...overrides,
    }).expect(201);
    return { venueId, booking: res.body.data };
  }

  const sendBack = (session, id, note = 'Please move this to the afternoon.') =>
    request(app).post(`/api/bookings/${id}/request-changes`).set(auth(session)).send({ note });

  const notificationsFor = async (email) => {
    const { rows } = await db.query(
      `SELECT n.category, n.title, n.message, n.booking_id FROM notifications n
         JOIN users u ON u.user_id = n.user_id WHERE u.email = $1 ORDER BY n.notification_id`,
      [email],
    );
    return rows;
  };

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, csCoordinator, gaurav, atharva, aditya] = await Promise.all([
      live.signIn(app, 'principal@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'coordinator.cs@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.jadhav@mmcoe.edu.in'),
      live.signIn(app, 'atharva.desai@mmcoe.edu.in'),
      live.signIn(app, 'aditya.patil@mmcoe.edu.in'),
    ]);
    const { rows } = await db.query(`SELECT club_id, club_name FROM clubs WHERE club_name IN ('IT Tech Club', 'Envision Club')`);
    rows.forEach((r) => { clubs[r.club_name] = r.club_id; });
  });

  afterAll(async () => {
    await db.closePool();
  });

  describe('request modification (FR13)', () => {
    it('sends a request back with a note, notifies and emails the requester, and audits it', async () => {
      const { booking } = await dscRequest();
      live.mailer.sendMailInBackground.mockClear();

      const res = await sendBack(itCoordinator, booking.id, 'Expected attendance is too high for a Friday.').expect(200);

      expect(res.body.data).toMatchObject({
        status: 'MODIFICATION_REQUESTED',
        modificationNote: 'Expected attendance is too high for a Friday.',
        decidedBy: { fullName: 'Nishanti Naidu' },
        event: { status: 'PENDING_APPROVAL' },
        permissions: { canDecide: false, canReject: true, canEdit: false },
      });

      const mail = live.sentMail('gaurav.jadhav@mmcoe.edu.in').at(-1);
      expect(mail.subject).toBe('"Hack Night" needs changes');
      expect(mail.text).toContain('What to change: Expected attendance is too high for a Friday.');

      const notes = await notificationsFor('gaurav.jadhav@mmcoe.edu.in');
      expect(notes.at(-1)).toMatchObject({ category: 'BOOKING_CHANGES_REQUESTED', title: 'Changes requested: Hack Night', booking_id: booking.id });

      const { rows: [log] } = await db.query(`SELECT action, details FROM admin_logs WHERE booking_id = $1`, [booking.id]);
      expect(log).toMatchObject({ action: 'BOOKING_MODIFICATION_REQUESTED', details: { note: 'Expected attendance is too high for a Friday.' } });
    });

    it('requires a note and a request that is still waiting on the approver', async () => {
      const { booking } = await dscRequest();
      const blank = await sendBack(itCoordinator, booking.id, '  ok ');
      expect(blank.status).toBe(422);

      await sendBack(itCoordinator, booking.id).expect(200);
      const again = await sendBack(itCoordinator, booking.id);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('BOOKING_NOT_PENDING');
    });

    it('is routed like any decision: other departments and club heads cannot send back', async () => {
      const { booking } = await dscRequest();
      await sendBack(csCoordinator, booking.id).expect(404);
      await sendBack(gaurav, booking.id).expect(403);
    });

    it('does not hold the slot: approving a competitor auto-rejects the request sent back', async () => {
      const { venueId, booking } = await dscRequest();
      const rival = await submit(atharva, {
        venueId, clubId: clubs['Envision Club'], date: day(30), startTime: '11:00', endTime: '13:00', title: 'Music Jam',
      }).expect(201);
      await sendBack(itCoordinator, booking.id).expect(200);
      live.mailer.sendMailInBackground.mockClear();

      await request(app).post(`/api/bookings/${rival.body.data.id}/approve`).set(auth(itCoordinator)).expect(200);

      const lost = await request(app).get(`/api/bookings/${booking.id}`).set(auth(gaurav)).expect(200);
      expect(lost.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: expect.stringMatching(/approved first/) });
      expect(live.sentMail('gaurav.jadhav@mmcoe.edu.in').at(-1).subject).toBe('"Hack Night" not approved');
      expect(live.sentMail('atharva.desai@mmcoe.edu.in').at(-1).subject).toBe('"Music Jam" approved');
    });

    it('can still reject a request that was sent back', async () => {
      const { booking } = await dscRequest();
      await sendBack(itCoordinator, booking.id).expect(200);

      const res = await request(app).post(`/api/bookings/${booking.id}/reject`).set(auth(itCoordinator))
        .send({ reason: 'No response from the club in time.' }).expect(200);
      expect(res.body.data).toMatchObject({ status: 'REJECTED', rejectionReason: 'No response from the club in time.' });
    });
  });

  describe('edit and resubmit', () => {
    const edit = (session, id, body) => request(app).patch(`/api/bookings/${id}`).set(auth(session)).send(body);

    it('lets the requester fix a sent-back request and puts it back in the inbox as PENDING', async () => {
      const { booking } = await dscRequest();
      await sendBack(itCoordinator, booking.id).expect(200);

      const res = await edit(gaurav, booking.id, { startTime: '14:00', endTime: '16:00', expectedAttendance: 40, title: 'Hack Night v2' }).expect(200);

      expect(res.body.data).toMatchObject({
        status: 'PENDING', revision: 1, startTime: '14:00', endTime: '16:00', decidedBy: null, decidedAt: null,
        modificationNote: 'Please move this to the afternoon.',
        event: { title: 'Hack Night v2', expectedAttendance: 40, status: 'PENDING_APPROVAL' },
        permissions: { canEdit: true, canCancel: true },
      });
      const { rows: [event] } = await db.query('SELECT start_time, end_time FROM events WHERE event_id = $1', [booking.event.id]);
      expect(event).toEqual({ start_time: '14:00:00', end_time: '16:00:00' });

      const inbox = await request(app).get('/api/bookings?view=decisions&pageSize=100').set(auth(itCoordinator)).expect(200);
      expect(inbox.body.data.find((b) => b.id === booking.id)).toMatchObject({ revision: 1, permissions: { canDecide: true } });

      const approverNote = (await notificationsFor('coordinator.it@mmcoe.edu.in')).filter((n) => n.booking_id === booking.id);
      expect(approverNote.map((n) => n.title)).toEqual(['New request: Hack Night', 'Updated request: Hack Night v2']);
    });

    it('lets the original requester and the current club head edit, never a stranger or faculty', async () => {
      const { booking } = await dscRequest();
      // As if Aditya had requested it while he led the club.
      await db.query(`UPDATE bookings SET requested_by = (SELECT user_id FROM users WHERE email = 'aditya.patil@mmcoe.edu.in') WHERE booking_id = $1`, [booking.id]);

      await edit(atharva, booking.id, { title: 'Hijacked' }).expect(404);
      await edit(csCoordinator, booking.id, { title: 'Other dept' }).expect(404);
      await edit(itCoordinator, booking.id, { title: 'Faculty edit' }).expect(403);
      await edit(aditya, booking.id, { title: 'Former head edit' }).expect(200);
      const res = await edit(gaurav, booking.id, { description: 'Bring laptops' }).expect(200);
      expect(res.body.data).toMatchObject({ event: { description: 'Bring laptops', title: 'Former head edit' }, revision: 2 });
    });

    it('moves the request to another venue, checking the new venue\'s capacity and bookings', async () => {
      const { booking } = await dscRequest();
      const small = await newVenue({ capacity: 30 });
      const busy = await newVenue();
      await submit(itCoordinator, { venueId: busy, date: day(30), startTime: '09:00', endTime: '11:00', title: 'Dept Meeting' }).expect(201);

      const tooMany = await edit(gaurav, booking.id, { venueId: small });
      expect(tooMany.status).toBe(422);
      expect(tooMany.body.error.details[0]).toMatchObject({ field: 'expectedAttendance' });

      const clash = await edit(gaurav, booking.id, { venueId: busy });
      expect(clash.status).toBe(409);
      expect(clash.body.error).toMatchObject({ code: 'SLOT_UNAVAILABLE', details: { conflicts: [expect.objectContaining({ title: 'Dept Meeting' })] } });
      expect(clash.body.error.details.suggestions.length).toBeGreaterThan(0);

      const moved = await edit(gaurav, booking.id, { venueId: busy, startTime: '11:15', endTime: '13:00' }).expect(200);
      expect(moved.body.data).toMatchObject({ venue: { id: busy }, startTime: '11:15', revision: 1 });
    });

    it('validates the edited window and the request body', async () => {
      const { booking } = await dscRequest();
      const past = await edit(gaurav, booking.id, { date: day(-2) });
      expect(past.status).toBe(422);

      const nothing = await edit(gaurav, booking.id, {});
      expect(nothing.status).toBe(422);

      const club = await edit(gaurav, booking.id, { title: 'New club', clubId: clubs['Envision Club'] });
      expect(club.status).toBe(422);
      expect(club.body.error.details[0].message).toMatch(/cannot be changed/);

      const inactive = await newVenue();
      await request(app).patch(`/api/venues/${inactive}`).set(auth(principal)).send({ isActive: false }).expect(200);
      const gone = await edit(gaurav, booking.id, { venueId: inactive });
      expect(gone.status).toBe(422);
      expect(gone.body.error.details[0]).toMatchObject({ field: 'venueId' });
    });

    it('refuses to edit a decided request or one that does not exist', async () => {
      const { booking } = await dscRequest();
      await request(app).post(`/api/bookings/${booking.id}/approve`).set(auth(itCoordinator)).expect(200);

      const decided = await edit(gaurav, booking.id, { title: 'Too late' });
      expect(decided.status).toBe(409);
      expect(decided.body.error.code).toBe('BOOKING_NOT_EDITABLE');

      await edit(gaurav, 99999999, { title: 'Nobody' }).expect(404);
    });

    it('refuses to edit a request whose time has already passed', async () => {
      const { booking } = await dscRequest();
      await db.query(
        `UPDATE bookings SET start_at = now() - interval '2 hours', end_at = now() - interval '1 hour' WHERE booking_id = $1`,
        [booking.id],
      );
      const res = await edit(gaurav, booking.id, { title: 'Past' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BOOKING_EXPIRED');

      const decide = await sendBack(itCoordinator, booking.id);
      expect(decide.body.error.code).toBe('BOOKING_EXPIRED');
    });
  });

  describe('the approver inbox', () => {
    it('lists requests waiting on the club separately from those waiting on the approver', async () => {
      const { booking: waiting } = await dscRequest();
      const { booking: sentBack } = await dscRequest();
      await sendBack(itCoordinator, sentBack.id).expect(200);

      const pending = await request(app).get('/api/bookings?view=decisions&pageSize=100').set(auth(itCoordinator)).expect(200);
      const onClub = await request(app).get('/api/bookings?view=decisions&status=MODIFICATION_REQUESTED&pageSize=100').set(auth(itCoordinator)).expect(200);

      expect(pending.body.data.map((b) => b.id)).toContain(waiting.id);
      expect(pending.body.data.map((b) => b.id)).not.toContain(sentBack.id);
      expect(onClub.body.data.map((b) => b.id)).toContain(sentBack.id);
      expect(onClub.body.data.every((b) => b.status === 'MODIFICATION_REQUESTED')).toBe(true);

      // Any other status falls back to the approver's pending queue.
      const fallback = await request(app).get('/api/bookings?view=decisions&status=APPROVED&pageSize=100').set(auth(itCoordinator)).expect(200);
      expect(fallback.body.data.every((b) => b.status === 'PENDING')).toBe(true);
    });

    it('shows how many other requests compete for the same window', async () => {
      const { venueId, booking } = await dscRequest();
      await submit(atharva, { venueId, clubId: clubs['Envision Club'], date: day(30), startTime: '11:00', endTime: '12:30', title: 'Jam' }).expect(201);
      await submit(atharva, { venueId, clubId: clubs['Envision Club'], date: day(30), startTime: '15:00', endTime: '16:00', title: 'Later' }).expect(201);

      const res = await request(app).get(`/api/bookings/${booking.id}`).set(auth(itCoordinator)).expect(200);
      expect(res.body.data.competingRequests).toBe(1);
    });

    it('returns badge counts for approvers and requesters', async () => {
      const coordinatorBefore = (await request(app).get('/api/bookings/summary').set(auth(csCoordinator)).expect(200)).body.data;
      const { booking } = await dscRequest();
      await sendBack(itCoordinator, booking.id).expect(200);
      await dscRequest();

      const head = (await request(app).get('/api/bookings/summary').set(auth(gaurav)).expect(200)).body.data;
      expect(head.myChangesRequested).toBeGreaterThanOrEqual(1);
      expect(head.myAwaitingApproval).toBeGreaterThanOrEqual(1);
      expect(head.awaitingDecision).toBe(0);
      expect(head.unreadNotifications).toBeGreaterThanOrEqual(1);

      const coordinator = (await request(app).get('/api/bookings/summary').set(auth(itCoordinator)).expect(200)).body.data;
      expect(coordinator.awaitingDecision).toBeGreaterThanOrEqual(1);
      // A DSC (IT) request never reaches the CS coordinator's badge.
      const csAfter = (await request(app).get('/api/bookings/summary').set(auth(csCoordinator)).expect(200)).body.data;
      expect(csAfter.awaitingDecision).toBe(coordinatorBefore.awaitingDecision);
    });
  });

  describe('decision notifications', () => {
    it('tells the requester about an approval and a rejection, by email and in-app', async () => {
      const { booking: good } = await dscRequest();
      const { booking: bad } = await dscRequest({ date: day(31) });
      live.mailer.sendMailInBackground.mockClear();

      await request(app).post(`/api/bookings/${good.id}/approve`).set(auth(itCoordinator)).expect(200);
      await request(app).post(`/api/bookings/${bad.id}/reject`).set(auth(itCoordinator)).send({ reason: 'Exam week <b>no events</b>' }).expect(200);

      const mails = live.sentMail('gaurav.jadhav@mmcoe.edu.in');
      expect(mails.map((m) => m.subject)).toEqual(['"Hack Night" approved', '"Hack Night" not approved']);
      expect(mails[1].html).toContain('Exam week &lt;b&gt;no events&lt;/b&gt;');
      expect(mails[1].text).toContain(`/bookings?focus=${bad.id}`);

      const categories = (await notificationsFor('gaurav.jadhav@mmcoe.edu.in')).slice(-2).map((n) => n.category);
      expect(categories).toEqual(['BOOKING_APPROVED', 'BOOKING_REJECTED']);
    });

    it('notifies requesters auto-rejected by a direct faculty booking', async () => {
      const { venueId, booking } = await dscRequest();
      live.mailer.sendMailInBackground.mockClear();

      await submit(itCoordinator, { venueId, date: day(30), startTime: '11:00', endTime: '12:00', title: 'Board Meeting' }).expect(201);

      expect(live.sentMail('gaurav.jadhav@mmcoe.edu.in').map((m) => m.subject)).toEqual(['"Hack Night" not approved']);
      const note = (await notificationsFor('gaurav.jadhav@mmcoe.edu.in')).at(-1);
      expect(note).toMatchObject({ category: 'BOOKING_REJECTED', booking_id: booking.id });
    });

    it('tells a requester when faculty cancel their booking, but not when they cancel it themselves', async () => {
      const { booking: byFaculty } = await dscRequest();
      const { booking: bySelf } = await dscRequest({ date: day(32) });
      live.mailer.sendMailInBackground.mockClear();

      await request(app).post(`/api/bookings/${byFaculty.id}/cancel`).set(auth(itCoordinator)).expect(200);
      await request(app).post(`/api/bookings/${bySelf.id}/cancel`).set(auth(gaurav)).expect(200);

      expect(live.sentMail('gaurav.jadhav@mmcoe.edu.in').map((m) => m.subject)).toEqual(['"Hack Night" cancelled']);
    });

    it('puts a new club request in every approver\'s bell, and a college-level one only with the Principal', async () => {
      const { booking } = await dscRequest();
      const { rows } = await db.query(
        `SELECT u.email FROM notifications n JOIN users u ON u.user_id = n.user_id
          WHERE n.booking_id = $1 AND n.category = 'BOOKING_REQUESTED' ORDER BY u.email`,
        [booking.id],
      );
      expect(rows.map((r) => r.email)).toEqual(['coordinator.it@mmcoe.edu.in', 'principal@mmcoe.edu.in']);

      const { rows: [club] } = await db.query(
        `INSERT INTO clubs (club_name, department_id, club_head_id)
         VALUES ($1, NULL, (SELECT user_id FROM users WHERE email = 'atharva.desai@mmcoe.edu.in')) RETURNING club_id`,
        [`College Council ${Date.now()}`],
      );
      const college = await submit(atharva, { venueId: await newVenue(), clubId: club.club_id, date: day(33), startTime: '10:00', endTime: '11:00' }).expect(201);
      const { rows: collegeRows } = await db.query(
        `SELECT u.email FROM notifications n JOIN users u ON u.user_id = n.user_id WHERE n.booking_id = $1`,
        [college.body.data.id],
      );
      expect(collegeRows.map((r) => r.email)).toEqual(['principal@mmcoe.edu.in']);
    });
  });

  describe('notifications API', () => {
    it('lists, counts, and marks notifications read - only ever the caller\'s own', async () => {
      const { booking } = await dscRequest();
      await sendBack(itCoordinator, booking.id).expect(200);

      const list = await request(app).get('/api/notifications?pageSize=5').set(auth(gaurav)).expect(200);
      expect(list.body.data[0]).toMatchObject({ category: 'BOOKING_CHANGES_REQUESTED', bookingId: booking.id, isRead: false });
      expect(list.body.meta.unread).toBeGreaterThanOrEqual(1);
      const id = list.body.data[0].id;

      await request(app).post(`/api/notifications/${id}/read`).set(auth(atharva)).expect(404);
      const read = await request(app).post(`/api/notifications/${id}/read`).set(auth(gaurav)).expect(200);
      expect(read.body.data).toMatchObject({ id, isRead: true, readAt: expect.any(String) });

      const unread = await request(app).get('/api/notifications?unread=true&pageSize=50').set(auth(gaurav)).expect(200);
      expect(unread.body.data.map((n) => n.id)).not.toContain(id);

      const all = await request(app).post('/api/notifications/read-all').set(auth(gaurav)).expect(200);
      expect(all.body.data.updated).toBeGreaterThanOrEqual(0);
      const after = await request(app).get('/api/notifications').set(auth(gaurav)).expect(200);
      expect(after.body.meta.unread).toBe(0);
    });

    it('returns an empty page for someone with no notifications, and validates input', async () => {
      const student = await live.createVerifiedStudent(app);
      const res = await request(app).get('/api/notifications').set(auth(student)).expect(200);
      expect(res.body).toMatchObject({ data: [], meta: { total: 0, unread: 0, totalPages: 0 } });

      await request(app).get('/api/notifications?pageSize=500').set(auth(student)).expect(422);
      await request(app).post('/api/notifications/abc/read').set(auth(student)).expect(422);
      await request(app).get('/api/notifications').expect(401);
    });
  });
});
