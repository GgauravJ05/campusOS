'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const catalogue = require('../services/reports/catalogue');
const format = require('../services/reports/format');
const tw = require('../services/scheduling/timeWindow');

/**
 * One report, in one of three formats (FR21). JSON feeds the screen; CSV and
 * PDF are the export the requirement names.
 */
const get = asyncHandler(async (req, res) => {
  const { report: key } = req.params;
  const { format: wanted = 'json', ...filters } = matchedData(req, { locations: ['query'] });

  // Which report, who may run it and how its rows are built are the report
  // object's business (domain/Report.js); this only picks the presentation.
  const result = await catalogue.get(key).run(req.user, filters);

  if (wanted === 'json') return sendSuccess(res, 200, result.toJSON());

  const filename = result.fileName(wanted === 'pdf' ? 'pdf' : 'csv', tw.campusToday());
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.set('Cache-Control', 'no-store');

  if (wanted === 'csv') {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    // A BOM so Excel opens UTF-8 names correctly rather than as mojibake.
    return res.send(result.toCsv({ bom: true }));
  }

  res.set('Content-Type', 'application/pdf');
  return result.toPdf(res, {
    generatedBy: req.user.fullName,
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
  });
});

/** The catalogue, so the UI does not hard-code what exists. */
const list = asyncHandler(async (req, res) => {
  const available = catalogue.visibleTo(req.user)
    .map(({ key, title, description }) => ({ key, title, description }));
  sendSuccess(res, 200, { reports: available, formats: format.FORMATS });
});

module.exports = { get, list };
