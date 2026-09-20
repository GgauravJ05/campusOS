'use strict';

/**
 * The one shared cache for small, read-often lookups: the scheduling, RSVP and
 * reminder settings and individual venue rows (OS Unit 4, page replacement:
 * see lib/ds/LruCache.js).
 *
 * Capacity is deliberately smaller than the number of venues in the seed data,
 * so venue lookups genuinely compete for slots and evictions happen.
 *
 * Staleness: writes made through this API invalidate their entry. A change made
 * directly in SQL cannot, so every entry also expires after TTL_MS. That is the
 * price of caching: reads are cheaper, and data may be up to TTL_MS old when
 * something bypasses the application.
 */

const LruCache = require('../lib/ds/LruCache');

const CAPACITY = 16;
const TTL_MS = 30_000;

const lookupCache = new LruCache({ capacity: CAPACITY, ttlMs: TTL_MS });

module.exports = lookupCache;
