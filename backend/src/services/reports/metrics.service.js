'use strict';

/**
 * The FR21 metrics: "venue utilization, club activity, and student
 * attendance metrics".
 *
 * Each report returns `{ rows, totals, period }` in the shape format.js
 * describes, so the JSON response, the CSV and the PDF are three renderings
 * of one result rather than three queries that can drift apart.
 *
 * Utilisation is measured against the venue's *bookable* hours - the
 * operating window in system_settings (C7), not 24 hours a day - because a
 * hall booked 9am to 5pm every day is fully used, not a third used.
 */

const db = require('../../config/db');
const settings = require('../settings.service');
const tw = require('../scheduling/timeWindow');
const { percent } = require('./format');

/** Longest period a single report will cover, so one click cannot scan years. */
const MAX_PERIOD_DAYS = 400;

/**
 * Resolves the requested window, defaulting to the last 30 days up to today.
 * @returns {{ from: string, to: string, days: number }}
 */
function resolvePeriod({ from, to } = {}) {
  const today = tw.campusToday();
  const end = to || today;
  const start = from || tw.addDays(end, -29);
  const days = Math.round((tw.toInstant(end, '00:00') - tw.toInstant(start, '00:00')) / 86_400_000) + 1;
  return { from: start, to: end, days: Math.min(Math.max(days, 1), MAX_PERIOD_DAYS) };
}

/** A coordinator sees their own department; the Principal / HOD sees everything. */
function departmentScope(actor, requestedDepartmentId) {
  if (actor.role === 'DEPT_COORDINATOR') return actor.departmentId;
  return requestedDepartmentId ?? null;
}

/**
 * FR21 venue utilisation. Counts approved bookings and the hours they
 * occupied, against the hours the venue could have been booked.
 */
async function venueUtilisation(actor, filters = {}) {
  const period = resolvePeriod(filters);
  const departmentId = departmentScope(actor, filters.departmentId);
  const rules = await settings.getSchedulingRules();
  const openHoursPerDay = (tw.toMinutes(rules.closingTime) - tw.toMinutes(rules.openingTime)) / 60;

  const perVenueQuery = `
    SELECT v.venue_id, v.venue_name, v.building, v.capacity,
           count(CASE WHEN b.status = 'APPROVED' THEN 1 END)::int AS bookings,
           count(CASE WHEN b.status = 'CANCELLED' THEN 1 END)::int AS cancelled,
           COALESCE(sum(CASE WHEN b.status = 'APPROVED'
                             THEN EXTRACT(EPOCH FROM (b.end_at - b.start_at)) / 3600
                        END), 0) AS hours
      FROM venues v
      LEFT JOIN bookings b ON b.venue_id = v.venue_id
       AND b.start_at >= $1::date AND b.start_at < $2::date + 1
     WHERE v.is_active
       AND ($3::int IS NULL OR v.department_id = $3)
     GROUP BY v.venue_id, v.venue_name, v.building, v.capacity`;

  const [{ rows }, { rows: [spread] }] = await Promise.all([
    db.query(`${perVenueQuery} ORDER BY hours DESC, v.venue_name`, [period.from, period.to, departmentId]),
    // MIN/MAX/AVG over the same per-venue figures, computed by the database
    // rather than in JS - "quietest", "busiest" and "typical" venue load,
    // the numbers a utilisation report actually exists to answer.
    db.query(
      `SELECT MIN(hours) AS min_hours, MAX(hours) AS max_hours, AVG(hours) AS avg_hours
         FROM (${perVenueQuery}) per_venue`,
      [period.from, period.to, departmentId],
    ),
  ]);

  const bookableHours = openHoursPerDay * period.days;
  const mapped = rows.map((row) => {
    const hours = Math.round(Number(row.hours) * 10) / 10;
    return {
      venueId: row.venue_id,
      venue: row.venue_name,
      building: row.building,
      capacity: row.capacity,
      bookings: row.bookings,
      cancelled: row.cancelled,
      hours,
      utilisationPercent: percent(hours, bookableHours),
    };
  });

  return {
    rows: mapped,
    period,
    totals: {
      venues: mapped.length,
      bookings: mapped.reduce((n, r) => n + r.bookings, 0),
      hours: Math.round(mapped.reduce((n, r) => n + r.hours, 0) * 10) / 10,
      bookableHoursPerVenue: Math.round(bookableHours * 10) / 10,
      openingTime: rules.openingTime,
      closingTime: rules.closingTime,
      // Every department in this schema owns at least one venue, so this
      // aggregate always has a row; no defensive fallback is reachable code.
      minHours: Math.round(Number(spread.min_hours) * 10) / 10,
      maxHours: Math.round(Number(spread.max_hours) * 10) / 10,
      avgHours: Math.round(Number(spread.avg_hours) * 10) / 10,
      busiestVenue: mapped[0].venue,
    },
  };
}

/** FR21 club activity: what each club ran and how many students it reached. */
async function clubActivity(actor, filters = {}) {
  const period = resolvePeriod(filters);
  const departmentId = departmentScope(actor, filters.departmentId);

  const { rows } = await db.query(
    `SELECT c.club_id, c.club_name, d.dept_code,
            count(DISTINCT e.event_id)::int AS events,
            count(DISTINCT CASE WHEN e.status IN ('PUBLISHED', 'COMPLETED') THEN e.event_id END)::int AS published,
            count(DISTINCT CASE WHEN e.status = 'CANCELLED' THEN e.event_id END)::int AS cancelled,
            count(CASE WHEN r.status <> 'CANCELLED' THEN r.registration_id END)::int AS registrations,
            COALESCE(sum(CASE WHEN r.status = 'RESERVED' THEN r.seats END), 0)::int AS seats_filled
       FROM clubs c
       LEFT JOIN departments d ON d.department_id = c.department_id
       LEFT JOIN events e ON e.club_id = c.club_id
        AND e.event_date >= $1::date AND e.event_date <= $2::date
       LEFT JOIN event_registrations r ON r.event_id = e.event_id
      WHERE c.is_active
        AND ($3::int IS NULL OR c.department_id = $3)
      GROUP BY c.club_id, c.club_name, d.dept_code
      ORDER BY events DESC, registrations DESC, c.club_name`,
    [period.from, period.to, departmentId],
  );

  const mapped = rows.map((row) => ({
    clubId: row.club_id,
    club: row.club_name,
    department: row.dept_code ?? 'College',
    events: row.events,
    published: row.published,
    cancelled: row.cancelled,
    registrations: row.registrations,
    seatsFilled: row.seats_filled,
  }));

  return {
    rows: mapped,
    period,
    totals: {
      clubs: mapped.length,
      events: mapped.reduce((n, r) => n + r.events, 0),
      registrations: mapped.reduce((n, r) => n + r.registrations, 0),
      seatsFilled: mapped.reduce((n, r) => n + r.seatsFilled, 0),
    },
  };
}

/**
 * FR21 student attendance: turnout per event. Only events that have actually
 * happened are counted - turnout for an event next week is not a metric, it
 * is a guess.
 */
async function attendance(actor, filters = {}) {
  const period = resolvePeriod(filters);
  const departmentId = departmentScope(actor, filters.departmentId);

  const { rows } = await db.query(
    `SELECT e.event_id, e.title, to_char(e.event_date, 'YYYY-MM-DD') AS event_date, e.category,
            COALESCE(c.club_name, d.dept_name, 'College event') AS organiser,
            count(CASE WHEN r.status = 'RESERVED' THEN r.registration_id END)::int AS registered,
            count(CASE WHEN a.status = 'PRESENT' THEN a.attendance_id END)::int AS present,
            count(CASE WHEN a.status = 'ABSENT' THEN a.attendance_id END)::int AS absent,
            count(CASE WHEN a.status = 'EXCUSED' THEN a.attendance_id END)::int AS excused
       FROM events e
       LEFT JOIN clubs c ON c.club_id = e.club_id
       LEFT JOIN departments d ON d.department_id = e.department_id
       LEFT JOIN event_registrations r ON r.event_id = e.event_id
       LEFT JOIN attendance a ON a.event_id = e.event_id
      WHERE e.event_date >= $1::date AND e.event_date <= $2::date
        AND e.event_date <= CURRENT_DATE
        AND e.status IN ('PUBLISHED', 'COMPLETED')
        AND ($3::int IS NULL OR e.department_id = $3)
      GROUP BY e.event_id, e.title, e.event_date, e.category, c.club_name, d.dept_name
      ORDER BY e.event_date DESC, e.title`,
    [period.from, period.to, departmentId],
  );

  const mapped = rows.map((row) => ({
    eventId: row.event_id,
    event: row.title,
    club: row.organiser,
    category: row.category,
    date: row.event_date,
    registered: row.registered,
    present: row.present,
    absent: row.absent,
    excused: row.excused,
    turnoutPercent: percent(row.present, row.registered),
  }));

  const registered = mapped.reduce((n, r) => n + r.registered, 0);
  const present = mapped.reduce((n, r) => n + r.present, 0);
  return {
    rows: mapped,
    period,
    totals: {
      events: mapped.length,
      registered,
      present,
      absent: mapped.reduce((n, r) => n + r.absent, 0),
      turnoutPercent: percent(present, registered),
    },
  };
}

const BUILDERS = { 'venue-utilisation': venueUtilisation, 'club-activity': clubActivity, attendance };

/**
 * @param {string} reportKey one of format.REPORT_KEYS
 * @returns {Promise<{ rows: object[], totals: object, period: object }>}
 */
function build(reportKey, actor, filters) {
  return BUILDERS[reportKey](actor, filters);
}

module.exports = { MAX_PERIOD_DAYS, resolvePeriod, departmentScope, venueUtilisation, clubActivity, attendance, build };
