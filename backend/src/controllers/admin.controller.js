'use strict';

const { matchedData } = require('express-validator');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const audit = require('../services/audit.service');

/** The FR20 trail, paged and filterable. */
const auditTrail = asyncHandler(async (req, res) => {
  const { items, meta } = await audit.list(matchedData(req, { locations: ['query'] }));
  sendSuccess(res, 200, items, meta);
});

/** The action vocabulary, so the filter UI is never out of date. */
const auditVocabulary = asyncHandler(async (_req, res) => {
  sendSuccess(res, 200, {
    groups: audit.GROUPS,
    actions: Object.entries(audit.ACTION_META).map(([action, meta]) => ({ action, ...meta })),
  });
});

module.exports = { auditTrail, auditVocabulary };
