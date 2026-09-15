'use strict';

/**
 * Writes to the immutable admin audit trail (FR20). The table rejects
 * UPDATE and DELETE at the database level; this is the only writer.
 */

const db = require('../config/db');

const ACTIONS = Object.freeze({
  ROLE_CHANGED: 'ROLE_CHANGED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',
});

/**
 * @param {{ adminId: number, action: string, targetType?: string, targetId?: number,
 *           details?: object, ip?: string, bookingId?: number }} entry
 * @param {import('pg').PoolClient} [client] pass the transaction client so the
 *        audit row commits or rolls back with the change it describes
 */
async function record({ adminId, action, targetType = null, targetId = null, details = {}, ip = null, bookingId = null }, client = db) {
  await client.query(
    `INSERT INTO admin_logs (admin_id, booking_id, action, target_type, target_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [adminId, bookingId, action, targetType, targetId, JSON.stringify(details), ip],
  );
}

module.exports = { record, ACTIONS };
