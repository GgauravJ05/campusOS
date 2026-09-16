'use strict';

/**
 * Phase 6 report shapes and the CSV writer (FR21). Pure functions, no
 * database.
 */

const format = require('../../src/services/reports/format');
const pdf = require('../../src/services/reports/pdf');

describe('report specs', () => {
  it('describes every report the API offers, each with columns', () => {
    expect(format.REPORT_KEYS).toEqual(['venue-utilisation', 'club-activity', 'attendance', 'audit-trail']);
    for (const key of format.REPORT_KEYS) {
      const spec = format.REPORTS[key];
      expect(spec.title).toEqual(expect.any(String));
      expect(spec.description).toEqual(expect.any(String));
      expect(spec.columns.length).toBeGreaterThan(0);
      expect(spec.columns.every((c) => c.key && c.label)).toBe(true);
    }
  });

  it('covers the three metrics FR21 names', () => {
    expect(format.REPORT_KEYS).toEqual(expect.arrayContaining(['venue-utilisation', 'club-activity', 'attendance']));
  });

  it('offers exactly the formats the requirement asks for', () => {
    expect(format.FORMATS).toEqual(['json', 'csv', 'pdf']);
  });
});

describe('csvField', () => {
  it('leaves an ordinary value alone', () => {
    expect(format.csvField('Main Auditorium')).toBe('Main Auditorium');
    expect(format.csvField(42)).toBe('42');
    expect(format.csvField(0)).toBe('0');
  });

  it('writes null and undefined as empty, not as "null"', () => {
    expect(format.csvField(null)).toBe('');
    expect(format.csvField(undefined)).toBe('');
  });

  it('quotes anything containing a comma, quote or newline', () => {
    expect(format.csvField('Seminar Hall A, Main Building')).toBe('"Seminar Hall A, Main Building"');
    expect(format.csvField('The "Big" Hall')).toBe('"The ""Big"" Hall"');
    expect(format.csvField('line one\nline two')).toBe('"line one\nline two"');
  });

  it('defuses a value Excel would run as a formula', () => {
    // A club named "=cmd|..." is a spreadsheet exploit, not a club.
    expect(format.csvField('=1+1')).toBe('"\t=1+1"');
    expect(format.csvField('+44 123')).toBe('"\t+44 123"');
    expect(format.csvField('-5')).toBe('"\t-5"');
    expect(format.csvField('@handle')).toBe('"\t@handle"');
  });
});

describe('toCsv', () => {
  const columns = [{ key: 'venue', label: 'Venue' }, { key: 'hours', label: 'Hours booked' }];

  it('writes a header and one CRLF-delimited line per row', () => {
    const csv = format.toCsv([{ venue: 'Hall A', hours: 12 }, { venue: 'Lab 1', hours: 3.5 }], columns);
    expect(csv).toBe('Venue,Hours booked\r\nHall A,12\r\nLab 1,3.5');
  });

  it('writes just the header when there is nothing to report', () => {
    expect(format.toCsv([], columns)).toBe('Venue,Hours booked');
  });

  it('ignores fields the report does not declare', () => {
    const csv = format.toCsv([{ venue: 'Hall A', hours: 1, secret: 'nope' }], columns);
    expect(csv).not.toMatch(/nope/);
  });

  it('fills a missing field rather than shifting the row', () => {
    expect(format.toCsv([{ venue: 'Hall A' }], columns)).toBe('Venue,Hours booked\r\nHall A,');
  });
});

describe('fileName', () => {
  it('names the download after the report and the day', () => {
    expect(format.fileName('venue-utilisation', 'csv', '2026-09-16'))
      .toBe('campusos-venue-utilisation-2026-09-16.csv');
    expect(format.fileName('attendance', 'pdf', '2026-09-16'))
      .toBe('campusos-attendance-2026-09-16.pdf');
  });
});

describe('percent', () => {
  it('rounds to one decimal place', () => {
    expect(format.percent(1, 3)).toBe(33.3);
    expect(format.percent(2, 3)).toBe(66.7);
  });

  it('is 0 rather than NaN when nothing happened', () => {
    expect(format.percent(0, 0)).toBe(0);
    expect(format.percent(5, 0)).toBe(0);
  });

  it('reaches exactly 100 when everything did', () => {
    expect(format.percent(7, 7)).toBe(100);
  });
});

describe('pdf layout', () => {
  const columns = [{ key: 'a', label: 'A', width: 100 }, { key: 'b', label: 'B', width: 300 }];

  it('scales declared widths to fill the page exactly', () => {
    const laid = pdf.layoutColumns(columns, 800);
    expect(laid.map((c) => c.drawWidth)).toEqual([200, 600]);
    expect(laid.reduce((sum, c) => sum + c.drawWidth, 0)).toBe(800);
  });

  it('gives an undeclared width a sensible default', () => {
    const laid = pdf.layoutColumns([{ key: 'a', label: 'A' }], 100);
    expect(laid[0].drawWidth).toBe(100);
  });

  it('turns totals into a readable line', () => {
    expect(pdf.totalsLine({ bookings: 42, seatsFilled: 118 }))
      .toBe('Bookings: 42   ·   Seats Filled: 118');
  });
});

describe('pdf rendering', () => {
  const { Writable } = require('node:stream');

  /** Collects the document into a buffer so the test can inspect it. */
  function collect() {
    const chunks = [];
    const stream = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb() } });
    stream.result = () => Buffer.concat(chunks);
    return stream;
  }

  const report = (rows) => ({
    spec: format.REPORTS['venue-utilisation'],
    rows,
    totals: { venues: rows.length },
    period: { from: '2026-09-01', to: '2026-09-16', days: 16 },
    generatedBy: 'Dr. Principal',
    generatedAt: '2026-09-16 12:00',
  });

  const done = (stream) => new Promise((resolve) => stream.on('finish', resolve));

  it('produces a valid PDF', async () => {
    const stream = collect();
    pdf.render(report([{ venue: 'Hall A', building: 'Main', capacity: 200, bookings: 4, hours: 8, utilisationPercent: 12.5, cancelled: 0 }]), stream);
    await done(stream);

    const buffer = stream.result();
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('renders an empty report rather than an empty file', async () => {
    const stream = collect();
    pdf.render(report([]), stream);
    await done(stream);
    expect(stream.result().subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('paginates a long report without falling off the page', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      venue: `Hall ${i}`, building: 'Main', capacity: 100, bookings: i, hours: i, utilisationPercent: i, cancelled: 0,
    }));
    const stream = collect();
    pdf.render(report(rows), stream);
    await done(stream);

    const buffer = stream.result();
    // More than one page object means the table actually broke across pages.
    expect(buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g).length).toBeGreaterThan(1);
  });
});
