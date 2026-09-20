'use strict';

/**
 * The shared LRU lookup cache in front of settings and venue rows, and the
 * hit/miss counters the health endpoint reports.
 */

jest.mock('../../src/services/mail/mailer');

const live = require('../helpers/liveApp');
const lookupCache = require('../../src/services/lookupCache');
const settings = require('../../src/services/settings.service');
const venues = require('../../src/services/venues/venue.service');

const { request, db, describeWithDb } = live;

describeWithDb('lookup cache (database)', () => {
  let app;
  let principal;
  const auth = (s) => ({ Authorization: `Bearer ${s.accessToken}` });

  beforeAll(async () => {
    app = live.createApp();
    principal = await live.signIn(app, 'principal@mmcoe.edu.in');
  });

  beforeEach(() => lookupCache.clear());

  afterAll(async () => {
    await db.closePool();
  });

  it('serves settings from the cache after the first read, as one shared frozen object', async () => {
    const before = lookupCache.stats();
    const first = await settings.getSchedulingRules();
    const second = await settings.getSchedulingRules();
    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    const after = lookupCache.stats();
    expect(after.misses - before.misses).toBe(1);
    expect(after.hits - before.hits).toBe(1);
  });

  it('bypasses the cache for a transaction client, which must see its own uncommitted writes', async () => {
    const cachedRules = await settings.getRsvpRules(); // cached as committed
    const rollback = new Error('roll back');
    let inside;
    await db.withTransaction(async (client) => {
      await client.query(
        `UPDATE system_settings SET setting_value = $1 WHERE setting_key = 'rsvp.allow_waitlist'`,
        [cachedRules.allowWaitlist ? 'false' : 'true'],
      );
      inside = await settings.getRsvpRules(client);
      throw rollback; // undo the change
    }).catch((err) => { if (err !== rollback) throw err; });
    expect(inside.allowWaitlist).toBe(!cachedRules.allowWaitlist);
    expect(await settings.getRsvpRules()).toBe(cachedRules); // the cache never saw it
  });

  it('shows a direct SQL change only after invalidate(), which is why entries also expire', async () => {
    const original = await settings.getReminderRules();
    await db.query(`UPDATE system_settings SET setting_value = '36' WHERE setting_key = 'reminder.first_offset_hours'`);
    try {
      expect(await settings.getReminderRules()).toEqual(original); // stale, by design
      settings.invalidate();
      expect((await settings.getReminderRules()).firstOffsetHours).toBe(36);
    } finally {
      await db.query(`UPDATE system_settings SET setting_value = $1 WHERE setting_key = 'reminder.first_offset_hours'`, [String(original.firstOffsetHours)]);
      settings.invalidate();
    }
  });

  it('evicts venue rows once more venues are read than the cache holds', async () => {
    const { rows } = await db.query('SELECT venue_id FROM venues ORDER BY venue_id');
    expect(rows.length).toBeGreaterThan(lookupCache.stats().capacity); // else nothing could be evicted
    const before = lookupCache.stats().evictions;
    for (const { venue_id: id } of rows) await venues.findVenueRow(id);
    const stats = lookupCache.stats();
    expect(stats.size).toBe(stats.capacity);
    expect(stats.evictions - before).toBe(rows.length - stats.capacity);
  });

  it('does not cache a locking read, and drops the venue entry when it is updated', async () => {
    const created = await request(app).post('/api/venues').set(auth(principal)).send({
      name: `Cache Room ${Date.now()}`, building: 'Annexe', floor: 9, type: 'CLASSROOM', capacity: 30,
    }).expect(201);
    const id = created.body.data.id;

    await venues.findVenueRow(id); // warm
    const warm = lookupCache.stats();
    await db.withTransaction((client) => venues.findVenueRow(id, client, { forUpdate: true }));
    expect(lookupCache.stats().hits).toBe(warm.hits); // the locking read never touched the cache

    await request(app).patch(`/api/venues/${id}`).set(auth(principal)).send({ capacity: 77 }).expect(200);
    const fresh = await request(app).get(`/api/venues/${id}`).set(auth(principal)).expect(200);
    expect(fresh.body.data.capacity).toBe(77); // not the cached 30
  });

  it('does not cache a venue that does not exist', async () => {
    expect(await venues.findVenueRow(99999999)).toBeNull();
    expect(lookupCache.keys()).not.toContain('venue:99999999');
  });

  it('reports the counters on the metrics endpoint', async () => {
    await settings.getSchedulingRules();
    await settings.getSchedulingRules();
    const res = await request(app).get('/api/health/metrics').expect(200);
    const { cache } = res.body.data;
    expect(cache).toMatchObject({ capacity: 16, ttlMs: 30000 });
    // clear() empties entries but keeps the lifetime counters, so assert on what must hold.
    expect(cache.hits).toBeGreaterThanOrEqual(1);
    expect(cache.misses).toBeGreaterThanOrEqual(1);
    expect(cache.hitRate).toBeCloseTo(cache.hits / (cache.hits + cache.misses), 3);
  });
});
