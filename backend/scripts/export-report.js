#!/usr/bin/env node
'use strict';

/**
 * Writes an FR21 report to disk, for a scheduled or one-off export.
 *
 *   node scripts/export-report.js venue-utilisation
 *   node scripts/export-report.js attendance --format pdf --from 2026-08-01 --to 2026-08-31 --out ./exports
 *
 * Runs as the Principal (the same view the Principal's screen has), so it is
 * for the operator of the server, not for end users. Uses the report classes
 * in domain/Report.js and writes with `fs` (ReportResult.saveTo). Exit code 0
 * on success, 1 on a usage or runtime error.
 */

const { parseArgs } = require('node:util');
const path = require('node:path');

const USAGE = `Usage: node scripts/export-report.js <report> [--format csv|pdf|json] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out DIR]
Reports: venue-utilisation, club-activity, attendance, audit-trail`;

/** Pure and exported so it can be tested without a database. */
function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: 'string', default: 'csv' },
      from: { type: 'string' },
      to: { type: 'string' },
      out: { type: 'string', default: './exports' },
    },
  });
  const [report] = positionals;
  if (!report) throw new Error('Choose a report.');
  if (!['csv', 'pdf', 'json'].includes(values.format)) throw new Error(`Unknown format "${values.format}".`);
  for (const key of ['from', 'to']) {
    if (values[key] && !/^\d{4}-\d{2}-\d{2}$/.test(values[key])) throw new Error(`--${key} must be YYYY-MM-DD.`);
  }
  return { report, format: values.format, filters: { from: values.from, to: values.to }, out: path.resolve(values.out) };
}

async function main(argv) {
  const options = parseCli(argv);

  // Required late so a usage error does not need a configured environment.
  const catalogue = require('../src/services/reports/catalogue');
  const tw = require('../src/services/scheduling/timeWindow');
  const db = require('../src/config/db');

  const report = catalogue.get(options.report);
  if (!report) throw new Error(`Unknown report "${options.report}".`);

  try {
    const principal = { id: null, role: 'SUPER_ADMIN', departmentId: null, fullName: 'Scheduled export' };
    const result = await report.run(principal, options.filters);
    const file = await result.saveTo(options.out, options.format, {
      today: tw.campusToday(), generatedBy: principal.fullName, generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });
    process.stdout.write(`${file}\n`);
  } finally {
    await db.closePool();
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    process.exit(1);
  });
}

module.exports = { parseCli };
