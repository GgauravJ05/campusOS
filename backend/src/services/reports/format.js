'use strict';

/**
 * Report shapes and the CSV writer (FR21). Pure functions - no database, no
 * HTTP - so the column definitions and the escaping rules are unit tested
 * directly.
 *
 * Every report is described once, here, and the API, the CSV and the PDF all
 * read that description. A column added to a report therefore appears in all
 * three without anyone having to remember the other two.
 */

/**
 * @typedef {{ key: string, label: string, align?: 'left'|'right', width?: number }} Column
 * @typedef {{ key: string, title: string, description: string, columns: Column[] }} ReportSpec
 */

/** @type {Record<string, ReportSpec>} */
const REPORTS = Object.freeze({
  'venue-utilisation': {
    key: 'venue-utilisation',
    title: 'Venue utilisation',
    description: 'How heavily each venue was booked over the period.',
    columns: [
      { key: 'venue', label: 'Venue', width: 150 },
      { key: 'building', label: 'Building', width: 110 },
      { key: 'capacity', label: 'Capacity', align: 'right', width: 60 },
      { key: 'bookings', label: 'Bookings', align: 'right', width: 60 },
      { key: 'hours', label: 'Hours booked', align: 'right', width: 80 },
      { key: 'utilisationPercent', label: 'Utilisation %', align: 'right', width: 80 },
      { key: 'cancelled', label: 'Cancelled', align: 'right', width: 60 },
    ],
  },
  'club-activity': {
    key: 'club-activity',
    title: 'Club activity',
    description: 'What each club ran, and how many students it reached.',
    columns: [
      { key: 'club', label: 'Club', width: 160 },
      { key: 'department', label: 'Department', width: 90 },
      { key: 'events', label: 'Events', align: 'right', width: 60 },
      { key: 'published', label: 'Published', align: 'right', width: 65 },
      { key: 'cancelled', label: 'Cancelled', align: 'right', width: 65 },
      { key: 'registrations', label: 'Registrations', align: 'right', width: 85 },
      { key: 'seatsFilled', label: 'Seats filled', align: 'right', width: 75 },
    ],
  },
  attendance: {
    key: 'attendance',
    title: 'Student attendance',
    description: 'Turnout per event: who reserved a seat and who came.',
    columns: [
      { key: 'event', label: 'Event', width: 150 },
      { key: 'club', label: 'Organiser', width: 120 },
      { key: 'date', label: 'Date', width: 80 },
      { key: 'registered', label: 'Registered', align: 'right', width: 70 },
      { key: 'present', label: 'Present', align: 'right', width: 60 },
      { key: 'absent', label: 'Absent', align: 'right', width: 60 },
      { key: 'turnoutPercent', label: 'Turnout %', align: 'right', width: 70 },
    ],
  },
  'audit-trail': {
    key: 'audit-trail',
    title: 'Audit trail',
    description: 'Every recorded administrative action, newest first.',
    columns: [
      { key: 'at', label: 'When', width: 130 },
      { key: 'actor', label: 'Who', width: 130 },
      { key: 'role', label: 'Role', width: 100 },
      { key: 'label', label: 'Action', width: 140 },
      { key: 'subject', label: 'Subject', width: 90 },
      { key: 'ip', label: 'IP', width: 90 },
    ],
  },
});

const REPORT_KEYS = Object.freeze(Object.keys(REPORTS));
const FORMATS = Object.freeze(['json', 'csv', 'pdf']);

/**
 * One CSV field.
 *
 * Quoting rules that matter: a field containing a comma, a quote or a
 * newline is quoted and its quotes doubled, and a field that Excel would
 * otherwise read as a formula (=, +, -, @) is prefixed with a tab. That last
 * one is CSV injection - a club named "=cmd|..." is a spreadsheet exploit,
 * not a club.
 */
function csvField(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `\t${text}`;
  return /[",\n\r\t]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * @param {Array<object>} rows
 * @param {Column[]} columns
 * @returns {string} CRLF-delimited CSV, as the format's RFC specifies
 */
function toCsv(rows, columns) {
  const header = columns.map((c) => csvField(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => csvField(row[c.key])).join(','));
  return [header, ...body].join('\r\n');
}

/** `campusos-venue-utilisation-2026-09-16.csv` */
function fileName(reportKey, format, today) {
  return `campusos-${reportKey}-${today}.${format}`;
}

/** Percentage to one decimal place, and 0 rather than NaN when nothing happened. */
function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

module.exports = { REPORTS, REPORT_KEYS, FORMATS, csvField, toCsv, fileName, percent };
