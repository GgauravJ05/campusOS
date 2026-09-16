'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const metrics = require('../services/reports/metrics.service');
const audit = require('../services/audit.service');
const format = require('../services/reports/format');
const pdf = require('../services/reports/pdf');
const tw = require('../services/scheduling/timeWindow');

/** The audit trail is a report like any other, but it comes from audit.service. */
async function buildReport(reportKey, actor, filters) {
  if (reportKey !== 'audit-trail') return metrics.build(reportKey, actor, filters);

  if (actor.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('The audit trail is limited to the Principal / HOD');
  }
  const entries = await audit.listAll(filters);
  return {
    rows: entries.map((entry) => ({
      at: new Date(entry.at).toISOString().replace('T', ' ').slice(0, 19),
      actor: entry.actor.fullName,
      role: entry.actor.role,
      label: entry.label,
      subject: entry.subjectType ? `${entry.subjectType} ${entry.subjectId ?? ''}`.trim() : '',
      ip: entry.ip ?? '',
    })),
    totals: { entries: entries.length },
    period: metrics.resolvePeriod(filters),
  };
}

/**
 * One report, in one of three formats (FR21). JSON feeds the screen; CSV and
 * PDF are the export the requirement names.
 */
const get = asyncHandler(async (req, res) => {
  const { report } = req.params;
  const { format: wanted = 'json', ...filters } = matchedData(req, { locations: ['query'] });
  const spec = format.REPORTS[report];

  const { rows, totals, period } = await buildReport(report, req.user, filters);

  if (wanted === 'json') {
    return sendSuccess(res, 200, { report: spec.key, title: spec.title, columns: spec.columns, rows, totals, period });
  }

  const filename = format.fileName(report, wanted === 'pdf' ? 'pdf' : 'csv', tw.campusToday());
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.set('Cache-Control', 'no-store');

  if (wanted === 'csv') {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    // A BOM so Excel opens UTF-8 names correctly rather than as mojibake.
    return res.send(`﻿${format.toCsv(rows, spec.columns)}`);
  }

  res.set('Content-Type', 'application/pdf');
  return pdf.render({
    spec,
    rows,
    totals,
    period,
    generatedBy: req.user.fullName,
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
  }, res);
});

/** The catalogue, so the UI does not hard-code what exists. */
const list = asyncHandler(async (req, res) => {
  const available = Object.values(format.REPORTS)
    .filter((spec) => spec.key !== 'audit-trail' || req.user.role === 'SUPER_ADMIN')
    .map(({ key, title, description }) => ({ key, title, description }));
  sendSuccess(res, 200, { reports: available, formats: format.FORMATS });
});

module.exports = { get, list };
