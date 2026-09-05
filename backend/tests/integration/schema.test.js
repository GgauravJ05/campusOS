'use strict';

/**
 * Schema-level guarantees, verified against a real PostgreSQL database.
 *
 * These are the constraints the SRS treats as hard requirements, so they
 * are tested where they are enforced rather than only in application code.
 *
 * Requires a database with db/schema.sql applied:
 *
 *   createdb campusos_test
 *   psql -d campusos_test -f db/schema.sql -f db/seed.sql
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:5432/campusos_test npm test
 *
 * Without TEST_DATABASE_URL the whole suite is skipped, so `npm test` stays
 * green on a machine that has no PostgreSQL installed.
 */

const { Pool } = require('pg');

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

describeWithDb('database schema', () => {
  /** @type {Pool} */
  let pool;
  const fixtures = {};

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 4 });

    const { rows: [role] } = await pool.query(
      `SELECT role_id FROM roles WHERE role_key = 'CLUB_HEAD'`,
    );
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role_id, is_verified)
       VALUES ('Schema Test User', $1, 'x', $2, TRUE)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING user_id`,
      [`schema.test.${Date.now()}@mmcoe.edu.in`, role.role_id],
    );
    const { rows: [venue] } = await pool.query(
      `INSERT INTO venues (venue_name, building, floor, venue_type, capacity)
       VALUES ($1, 'Test Building', 1, 'SEMINAR_HALL', 100)
       RETURNING venue_id`,
      [`Schema Test Venue ${Date.now()}`],
    );
    const { rows: [club] } = await pool.query(
      `INSERT INTO clubs (club_name, club_head_id) VALUES ($1, $2) RETURNING club_id`,
      [`Schema Test Club ${Date.now()}`, user.user_id],
    );

    Object.assign(fixtures, { userId: user.user_id, venueId: venue.venue_id, clubId: club.club_id });
  });

  afterAll(async () => {
    if (!pool) return;

    await pool.query('DELETE FROM bookings WHERE venue_id = $1', [fixtures.venueId]);
    await pool.query('DELETE FROM events WHERE club_id = $1', [fixtures.clubId]);
    await pool.query('DELETE FROM clubs WHERE club_id = $1', [fixtures.clubId]);
    await pool.query('DELETE FROM venues WHERE venue_id = $1', [fixtures.venueId]);

    // The fixture user authored admin_logs rows, and admin_logs is
    // append-only by design (FR20) - so the audit trail pins the user row in
    // place and it cannot be hard deleted. That is the intended behaviour:
    // deactivate rather than delete, exactly as the application must.
    const { rows: [audit] } = await pool.query(
      'SELECT count(*)::int AS n FROM admin_logs WHERE admin_id = $1',
      [fixtures.userId],
    );

    if (audit.n > 0) {
      await pool.query('UPDATE users SET is_active = FALSE WHERE user_id = $1', [fixtures.userId]);
    } else {
      await pool.query('DELETE FROM users WHERE user_id = $1', [fixtures.userId]);
    }

    await pool.end();
  });

  /** Creates an event to hang bookings off. */
  async function createEvent(overrides = {}) {
    const { rows } = await pool.query(
      `INSERT INTO events (club_id, created_by, title, category, event_date, start_time, end_time, status, max_seats)
       VALUES ($1, $2, $3, $4, CURRENT_DATE + 7, '10:00', '12:00', 'APPROVED', $5)
       RETURNING event_id`,
      [
        fixtures.clubId,
        fixtures.userId,
        overrides.title || 'Schema Test Event',
        overrides.category || 'TECHNICAL',
        overrides.maxSeats ?? 2,
      ],
    );
    return rows[0].event_id;
  }

  async function createBooking({ eventId, status, start, end, approve = true }) {
    return pool.query(
      `INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, status, decided_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING booking_id`,
      [
        eventId,
        fixtures.venueId,
        fixtures.userId,
        approve ? fixtures.userId : null,
        start,
        end,
        status,
        approve ? new Date() : null,
      ],
    );
  }

  describe('venue double-booking (FR10)', () => {
    it('refuses a second APPROVED booking overlapping the first', async () => {
      const first = await createEvent();
      const second = await createEvent();

      await createBooking({
        eventId: first,
        status: 'APPROVED',
        start: '2030-01-01T10:00:00Z',
        end: '2030-01-01T12:00:00Z',
      });

      await expect(
        createBooking({
          eventId: second,
          status: 'APPROVED',
          start: '2030-01-01T11:00:00Z',
          end: '2030-01-01T13:00:00Z',
        }),
      ).rejects.toMatchObject({ code: '23P01' });
    });

    it('allows back-to-back bookings that only touch at the boundary', async () => {
      const first = await createEvent();
      const second = await createEvent();

      await createBooking({
        eventId: first,
        status: 'APPROVED',
        start: '2030-02-01T10:00:00Z',
        end: '2030-02-01T12:00:00Z',
      });

      // The range is [start, end) so 12:00-14:00 does not overlap 10:00-12:00.
      // The 15-minute buffer (FR9) is applied by the application, not here.
      await expect(
        createBooking({
          eventId: second,
          status: 'APPROVED',
          start: '2030-02-01T12:00:00Z',
          end: '2030-02-01T14:00:00Z',
        }),
      ).resolves.toBeDefined();
    });

    it('allows multiple competing PENDING requests for the same slot (FR12)', async () => {
      const first = await createEvent();
      const second = await createEvent();
      const window = { start: '2030-03-01T10:00:00Z', end: '2030-03-01T12:00:00Z' };

      await createBooking({ eventId: first, status: 'PENDING', approve: false, ...window });

      await expect(
        createBooking({ eventId: second, status: 'PENDING', approve: false, ...window }),
      ).resolves.toBeDefined();
    });
  });

  describe('booking decision integrity (FR13)', () => {
    it('refuses a REJECTED booking with no recorded reason', async () => {
      const eventId = await createEvent();

      await expect(
        pool.query(
          `INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, status, decided_at)
           VALUES ($1, $2, $3, $3, '2030-04-01T10:00:00Z', '2030-04-01T12:00:00Z', 'REJECTED', now())`,
          [eventId, fixtures.venueId, fixtures.userId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('refuses an end time at or before the start time', async () => {
      const eventId = await createEvent();

      await expect(
        createBooking({
          eventId,
          status: 'PENDING',
          approve: false,
          start: '2030-05-01T12:00:00Z',
          end: '2030-05-01T10:00:00Z',
        }),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('caps the extension at 15 minutes', async () => {
      const eventId = await createEvent();

      await expect(
        pool.query(
          `INSERT INTO bookings (event_id, venue_id, requested_by, start_at, end_at, status, extension_minutes)
           VALUES ($1, $2, $3, '2030-06-01T10:00:00Z', '2030-06-01T12:00:00Z', 'PENDING', 30)`,
          [eventId, fixtures.venueId, fixtures.userId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('seat capacity (FR15)', () => {
    it('refuses booked_seats above max_seats', async () => {
      const eventId = await createEvent({ maxSeats: 2 });

      await expect(
        pool.query('UPDATE events SET booked_seats = 3 WHERE event_id = $1', [eventId]),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('refuses a negative seat count', async () => {
      const eventId = await createEvent({ maxSeats: 2 });

      await expect(
        pool.query('UPDATE events SET booked_seats = -1 WHERE event_id = $1', [eventId]),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('refuses a duplicate RSVP from the same student', async () => {
      const eventId = await createEvent();

      await pool.query(
        'INSERT INTO event_registrations (event_id, student_id) VALUES ($1, $2)',
        [eventId, fixtures.userId],
      );

      await expect(
        pool.query('INSERT INTO event_registrations (event_id, student_id) VALUES ($1, $2)', [
          eventId,
          fixtures.userId,
        ]),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  describe('user credentials', () => {
    it('refuses an account with neither a password nor an OAuth identity', async () => {
      const { rows: [role] } = await pool.query(`SELECT role_id FROM roles WHERE role_key = 'STUDENT'`);

      await expect(
        pool.query(
          `INSERT INTO users (full_name, email, role_id) VALUES ('No Creds', $1, $2)`,
          [`nocreds.${Date.now()}@mmcoe.edu.in`, role.role_id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('accepts an OAuth-only account (FR1)', async () => {
      const { rows: [role] } = await pool.query(`SELECT role_id FROM roles WHERE role_key = 'STUDENT'`);
      const email = `oauth.${Date.now()}@gmail.com`;

      await expect(
        pool.query(
          `INSERT INTO users (full_name, email, oauth_provider, oauth_subject, role_id)
           VALUES ('OAuth User', $1, 'google', $2, $3)`,
          [email, `sub-${Date.now()}`, role.role_id],
        ),
      ).resolves.toBeDefined();

      await pool.query('DELETE FROM users WHERE email = $1', [email]);
    });
  });

  describe('audit trail immutability (FR20)', () => {
    it('refuses an UPDATE to admin_logs', async () => {
      const { rows: [log] } = await pool.query(
        `INSERT INTO admin_logs (admin_id, action) VALUES ($1, 'TEST_ACTION') RETURNING log_id`,
        [fixtures.userId],
      );

      await expect(
        pool.query(`UPDATE admin_logs SET action = 'TAMPERED' WHERE log_id = $1`, [log.log_id]),
      ).rejects.toThrow(/append-only/);
    });

    it('refuses a DELETE from admin_logs', async () => {
      const { rows: [log] } = await pool.query(
        `INSERT INTO admin_logs (admin_id, action) VALUES ($1, 'TEST_ACTION_2') RETURNING log_id`,
        [fixtures.userId],
      );

      await expect(
        pool.query('DELETE FROM admin_logs WHERE log_id = $1', [log.log_id]),
      ).rejects.toThrow(/append-only/);
    });
  });
});
