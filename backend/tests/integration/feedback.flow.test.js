'use strict';

/**
 * Post-event feedback against PostgreSQL: a typed rating column plus a JSONB
 * answers document whose shape depends on the event's category (DBMS Unit 5).
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const tw = require('../../src/services/scheduling/timeWindow');
const feedback = require('../../src/services/events/feedback.service');

const { request, db, describeWithDb } = live;

describeWithDb('event feedback (database)', () => {
  let app;
  let principal;
  let itCoordinator;
  let csCoordinator;
  let clubId;
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });
  const day = (n) => tw.addDays(tw.campusToday(), n);

  async function newVenue() {
    const res = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Feedback Hall ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      building: 'Feedback Block', floor: 1, type: 'SEMINAR_HALL', capacity: 100,
    }).expect(201);
    return res.body.data.id;
  }

  /** A published event that `attendees` hold seats at. */
  async function eventWith(attendees, { category = 'TECHNICAL', date = day(10), past = true } = {}) {
    const venueId = await newVenue();
    const booking = await request(app).post('/api/bookings').set(auth(itCoordinator)).send({
      venueId, clubId, title: `Feedback ${category}`, category,
      expectedAttendance: 20, date, startTime: '10:00', endTime: '12:00',
    }).expect(201);
    const eventId = booking.body.data.event.id;
    await request(app).post(`/api/events/${eventId}/publish`).set(auth(itCoordinator)).send({ maxSeats: 20 }).expect(200);
    for (const s of attendees) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post(`/api/events/${eventId}/registrations`).set(auth(s)).send({}).expect(201);
    }
    if (past) {
      await db.query('UPDATE events SET event_date = CURRENT_DATE - 1 WHERE event_id = $1', [eventId]);
      await db.query(
        `UPDATE bookings SET start_at = now() - interval '2 days', end_at = now() - interval '2 days' + interval '2 hours'
          WHERE event_id = $1`, [eventId],
      );
    }
    return eventId;
  }

  const post = (session, eventId, body) => request(app).post(`/api/events/${eventId}/feedback`).set(auth(session)).send(body);
  const student = (name) => live.createVerifiedStudent(app, { fullName: name });

  beforeAll(async () => {
    app = live.createApp();
    [principal, itCoordinator, csCoordinator] = await Promise.all([
      live.signIn(app, 'gaurav.principal@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.coordinator.it@mmcoe.edu.in'),
      live.signIn(app, 'gaurav.coordinator.cs@mmcoe.edu.in'),
    ]);
    ({ rows: [{ club_id: clubId }] } = await db.query(`SELECT club_id FROM clubs WHERE club_name = 'IT Tech Club'`));
  });

  afterAll(async () => {
    await db.closePool();
  });

  describe('the form', () => {
    it('asks the questions for the event\'s category', async () => {
      const a = await student('Form Student');
      const workshop = await eventWith([a], { category: 'WORKSHOP', date: day(11) });
      const res = await request(app).get(`/api/events/${workshop}/feedback/form`).set(auth(a)).expect(200);
      expect(Object.keys(res.body.data.questions).sort()).toEqual(['materials_helpful', 'would_repeat']);
      expect(res.body.data.rating).toEqual({ min: 1, max: 5 });
    });

    it('falls back to the generic questions for a category it has no set for', () => {
      expect(Object.keys(feedback.questionsFor('NOT_A_CATEGORY'))).toEqual(['would_repeat']);
    });
  });

  describe('submitting', () => {
    it('stores the rating as a column and the answers as one JSONB document', async () => {
      const a = await student('Reviewer One');
      const eventId = await eventWith([a], { date: day(12) });

      const res = await post(a, eventId, {
        rating: 4, answers: { difficulty: 'JUST_RIGHT', would_repeat: true, comment: '  Great pace  ' },
      }).expect(200);
      expect(res.body.data).toMatchObject({ rating: 4, answers: { difficulty: 'JUST_RIGHT', would_repeat: true, comment: 'Great pace' } });

      const { rows: [row] } = await db.query(
        `SELECT rating, jsonb_typeof(answers) AS kind, answers->>'difficulty' AS difficulty
           FROM event_feedback WHERE event_id = $1 AND student_id = $2`, [eventId, a.user.id],
      );
      expect(row).toEqual({ rating: 4, kind: 'object', difficulty: 'JUST_RIGHT' });
    });

    it('replaces an earlier response instead of adding a second', async () => {
      const a = await student('Changed Mind');
      const eventId = await eventWith([a], { date: day(13) });
      await post(a, eventId, { rating: 2, answers: { would_repeat: false } }).expect(200);
      await post(a, eventId, { rating: 5, answers: { would_repeat: true } }).expect(200);

      const { rows } = await db.query('SELECT rating, answers FROM event_feedback WHERE event_id = $1', [eventId]);
      expect(rows).toEqual([{ rating: 5, answers: { would_repeat: true } }]);
    });

    it('accepts a rating with no answers, and drops a blank comment', async () => {
      const a = await student('Terse');
      const eventId = await eventWith([a], { date: day(14) });
      const res = await post(a, eventId, { rating: 3, answers: { comment: '   ' } }).expect(200);
      expect(res.body.data.answers).toEqual({});
      await post(a, eventId, { rating: 3 }).expect(200);
    });

    it('rejects a rating outside 1-5', async () => {
      const a = await student('Bad Rating');
      const eventId = await eventWith([a], { date: day(15) });
      await post(a, eventId, { rating: 6 }).expect(422);
      await post(a, eventId, { rating: 0 }).expect(422);
      await post(a, eventId, {}).expect(422);
    });

    it('rejects questions from another category, wrong types and long comments', async () => {
      const a = await student('Bad Answers');
      const eventId = await eventWith([a], { date: day(16) }); // TECHNICAL
      const res = await post(a, eventId, {
        rating: 3,
        answers: { materials_helpful: true, would_repeat: 'yes', difficulty: 'MEH', comment: 'x'.repeat(501) },
      }).expect(422);
      expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
        'answers.comment', 'answers.difficulty', 'answers.materials_helpful', 'answers.would_repeat',
      ]);
      await post(a, eventId, { rating: 3, answers: { comment: 42 } }).expect(422);
    });

    it('refuses feedback before the event has started', async () => {
      const a = await student('Too Early');
      const eventId = await eventWith([a], { date: day(17), past: false });
      const res = await post(a, eventId, { rating: 5 }).expect(409);
      expect(res.body.error.code).toBe('EVENT_NOT_STARTED');
    });

    it('accepts feedback once the event has been marked COMPLETED, and hides a cancelled one', async () => {
      const a = await student('Completed Fan');
      const eventId = await eventWith([a], { date: day(18) });
      await db.query(`UPDATE events SET status = 'COMPLETED' WHERE event_id = $1`, [eventId]);
      await post(a, eventId, { rating: 5 }).expect(200);

      const b = await student('Cancelled Fan');
      const cancelled = await eventWith([b], { date: day(24) });
      await db.query(`UPDATE events SET status = 'CANCELLED' WHERE event_id = $1`, [cancelled]);
      await post(b, cancelled, { rating: 5 }).expect(404);
    });

    it('refuses someone who never held a seat', async () => {
      const attendee = await student('Was There');
      const outsider = await student('Was Not');
      const eventId = await eventWith([attendee], { date: day(19) });
      await post(outsider, eventId, { rating: 5 }).expect(403);
    });

    it('requires sign-in', async () => {
      await request(app).post('/api/events/1/feedback').send({ rating: 5 }).expect(401);
    });
  });

  describe('the organiser\'s summary', () => {
    it('tallies ratings and every answered question across the JSONB documents', async () => {
      const [a, b, c, d] = await Promise.all(['Sam Alpha', 'Sam Bravo', 'Sam Charlie', 'Sam Delta'].map(student));
      const eventId = await eventWith([a, b, c, d], { date: day(20) });
      await post(a, eventId, { rating: 5, answers: { difficulty: 'JUST_RIGHT', would_repeat: true, comment: 'Loved it' } }).expect(200);
      await post(b, eventId, { rating: 4, answers: { difficulty: 'JUST_RIGHT', would_repeat: true } }).expect(200);
      await post(c, eventId, { rating: 2, answers: { difficulty: 'TOO_HARD', would_repeat: false, comment: 'Too fast' } }).expect(200);
      // d never responds.

      const res = await request(app).get(`/api/events/${eventId}/feedback`).set(auth(itCoordinator)).expect(200);
      expect(res.body.data).toMatchObject({
        responses: 3,
        averageRating: 3.67,
        minRating: 2,
        maxRating: 5,
        ratingSpread: { 2: 1, 4: 1, 5: 1 },
        questions: {
          difficulty: { JUST_RIGHT: 2, TOO_HARD: 1 },
          would_repeat: { true: 2, false: 1 },
        },
        wouldRepeat: 2,
      });
      expect(res.body.data.comments.sort()).toEqual(['Loved it', 'Too fast']);
      // Anonymous: nothing in the summary says who answered.
      expect(JSON.stringify(res.body.data)).not.toMatch(/Sam |@mmcoe/);
    });

    it('is honest about an event nobody has reviewed', async () => {
      const a = await student('Silent');
      const eventId = await eventWith([a], { date: day(21) });
      const res = await request(app).get(`/api/events/${eventId}/feedback`).set(auth(principal)).expect(200);
      expect(res.body.data).toMatchObject({
        responses: 0, averageRating: null, ratingSpread: {}, questions: {}, wouldRepeat: 0, comments: [],
      });
    });

    it('is closed to students and to other departments\' coordinators', async () => {
      const a = await student('Curious');
      const eventId = await eventWith([a], { date: day(22) });
      await request(app).get(`/api/events/${eventId}/feedback`).set(auth(a)).expect(403);
      await request(app).get(`/api/events/${eventId}/feedback`).set(auth(csCoordinator)).expect(403);
    });
  });

  describe('the database', () => {
    it('refuses an answers value that is not a JSON object', async () => {
      const a = await student('Raw Insert');
      const eventId = await eventWith([a], { date: day(23) });
      await expect(db.query(
        `INSERT INTO event_feedback (event_id, student_id, rating, answers) VALUES ($1, $2, 3, '[1,2]'::jsonb)`,
        [eventId, a.user.id],
      )).rejects.toMatchObject({ code: '23514' });
    });

    it('has a GIN index on the answers document', async () => {
      const { rows: [idx] } = await db.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_event_feedback_answers'`,
      );
      expect(idx.indexdef).toMatch(/USING gin \(answers jsonb_path_ops\)/);
    });
  });
});
