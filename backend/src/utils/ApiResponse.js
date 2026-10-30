'use strict';

/**
 * One response envelope for the whole API, so the frontend never has to
 * guess where the payload lives.
 *
 *   success: { success: true,  data: ..., meta?: ... }
 *   failure: { success: false, error: { code, message, details? } }
 */

/**
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {unknown} data
 * @param {object} [meta] pagination or other envelope-level information
 */
function sendSuccess(res, statusCode, data, meta) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(statusCode).json(body);
}

/**
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} code
 * @param {string} message
 * @param {unknown} [details]
 */
function sendError(res, statusCode, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return res.status(statusCode).json({ success: false, error });
}

module.exports = { sendSuccess, sendError };
