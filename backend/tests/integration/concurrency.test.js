'use strict';

/**
 * Concurrency proof for FR10: "zero duplicate venue bookings under
 * simultaneous concurrent load".
 *
 * This is the claim the SRS makes most loudly, so it is tested against a
 * real database with genuinely parallel transactions rather than asserted
 * in a comment. Phase 2's booking service will reuse this harness.
 *
 * Requires TEST_DATABASE_URL; skipped otherwise. See schema.test.js.
 */

const { Pool } = require('pg');

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDb = connectionString ? describe : describe.skip;

/** How many clients pile onto the same slot at once. */
const CONCURRENT_REQUESTS = 50;

describeWithDb('concurrent venue booking (FR10)', () => {
  /** @type {Pool} */
  let pool;
  const fixtures = {};

  beforeAll(async () => {
    // The pool must be able to hold every racer at once, otherwise the
    // requests queue and the test proves nothing about concurrency.
    pool = new Pool({ connectionString, max: CONCURRENT_REQUESTS + 5 });

    const { rows: [role] } = await pool.query(`SELECT role_id FROM roles WHERE role_key = 'CLUB_HEAD'`);
    const stamp = Date.now();

    const { rows: [user] } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role_id, is_verified)
       VALUES ('Concurrency Tester', $1, 'x', $2, TRUE) RETURNING user_id`,
      [`concurrency.${stamp}@mmcoe.edu.in`, role.role_id],
    );
    const { rows: [venue] } = await pool.query(
      `INSERT INTO venues (venue_name, building, floor, venue_type, capacity)
       VALUES ($1, 'Race Building', 1, 'AUDITORIUM', 300) RETURNING venue_id`,
      [`Race Venue ${stamp}`],
    );
    const { rows: [club] } = await pool.query(
      `INSERT INTO clubs (club_name, club_head_id) VALUES ($1, $2) RETURNING club_id`,
      [`Race Club ${stamp}`, user.user_id],
    );

    Object.assign(fixtures, { userId: user.user_id, venueId: venue.venue_id, clubId: club.club_id });
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM bookings WHERE venue_id = $1', [fixtures.venueId]);
    await pool.query('DELETE FROM events WHERE club_id = $1', [fixtures.clubId]);
    await pool.query('DELETE FROM clubs WHERE club_id = $1', [fixtures.clubId]);
    await pool.query('DELETE FROM venues WHERE venue_id = $1', [fixtures.venueId]);
    await pool.query('DELETE FROM users WHERE user_id = $1', [fixtures.userId]);
    await pool.end();
  });

  async function createEvent(index) {
    const { rows } = await pool.query(
      `INSERT INTO events (club_id, created_by, title, category, event_date, start_time, end_time, status)
       VALUES ($1, $2, $3, 'TECHNICAL', CURRENT_DATE + 30, '14:00', '16:00', 'APPROVED')
       RETURNING event_id`,
      [fixtures.clubId, fixtures.userId, `Race Event ${index}`],
    );
    return rows[0].event_id;
  }

  /**
   * One competing approval attempt, shaped the way the Phase 2 booking
   * service will be: a transaction that takes a row-level lock on the
   * venue, checks for a conflicting approved booking, then inserts.
   */
  async function attemptApproval({ eventId, start, end }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Serialise every racer on this venue's row (FR10 pessimistic lock).
      await client.query('SELECT venue_id FROM venues WHERE venue_id = $1 FOR UPDATE', [
        fixtures.venueId,
      ]);

      // FR8 interval overlap check, buffer omitted for clarity.
      const { rows } = await client.query(
        `SELECT 1 FROM bookings
          WHERE venue_id = $1 AND status = 'APPROVED'
            AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')
          LIMIT 1`,
        [fixtures.venueId, start, end],
      );

      if (rows.length > 0) {
        await client.query('ROLLBACK');
        return 'rejected';
      }

      await client.query(
        `INSERT INTO bookings (event_id, venue_id, requested_by, approved_by, start_at, end_at, status, decided_at)
         VALUES ($1, $2, $3, $3, $4, $5, 'APPROVED', now())`,
        [eventId, fixtures.venueId, fixtures.userId, start, end],
      );

      await client.query('COMMIT');
      return 'approved';
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      // 23P01 is the exclusion constraint refusing the overlap - the
      // database backstop doing its job.
      return err.code === '23P01' ? 'rejected' : `error:${err.code}`;
    } finally {
      client.release();
    }
  }

  it(`grants the slot to exactly one of ${CONCURRENT_REQUESTS} simultaneous approvals`, async () => {
    const window = { start: '2031-01-15T14:00:00Z', end: '2031-01-15T16:00:00Z' };

    const eventIds = [];
    for (let i = 0; i < CONCURRENT_REQUESTS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      eventIds.push(await createEvent(i));
    }

    // Fire them all at once - no awaiting inside the loop.
    const outcomes = await Promise.all(
      eventIds.map((eventId) => attemptApproval({ eventId, ...window })),
    );

    const approved = outcomes.filter((o) => o === 'approved');
    const rejected = outcomes.filter((o) => o === 'rejected');
    const errored = outcomes.filter((o) => o.startsWith('error:'));

    expect(errored).toEqual([]);
    expect(approved).toHaveLength(1);
    expect(rejected).toHaveLength(CONCURRENT_REQUESTS - 1);

    // And the database agrees: one approved booking for that window.
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM bookings
        WHERE venue_id = $1 AND status = 'APPROVED'
          AND tstzrange(start_at, end_at, '[)') && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
      [fixtures.venueId, window.start, window.end],
    );
    expect(rows[0].n).toBe(1);
  }, 30000);

  it('still allows a non-overlapping slot on the same venue under load', async () => {
    const morning = { start: '2031-02-10T09:00:00Z', end: '2031-02-10T11:00:00Z' };
    const evening = { start: '2031-02-10T17:00:00Z', end: '2031-02-10T19:00:00Z' };

    const [a, b, c, d] = await Promise.all([
      createEvent(101), createEvent(102), createEvent(103), createEvent(104),
    ]);

    const outcomes = await Promise.all([
      attemptApproval({ eventId: a, ...morning }),
      attemptApproval({ eventId: b, ...morning }),
      attemptApproval({ eventId: c, ...evening }),
      attemptApproval({ eventId: d, ...evening }),
    ]);

    // One winner per distinct window - concurrency control must not become
    // a blanket lock that starves unrelated bookings.
    expect(outcomes.filter((o) => o === 'approved')).toHaveLength(2);
    expect(outcomes.filter((o) => o === 'rejected')).toHaveLength(2);
  }, 30000);
});
