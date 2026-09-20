'use strict';

/**
 * The audit trail's own rules (FR20), without a database: how a row reads,
 * and the promise that recording a login can never break a sign-in.
 */

const audit = require('../../src/services/audit.service');

const row = (overrides = {}) => ({
  log_id: '42',
  admin_id: 2,
  booking_id: null,
  action: 'ROLE_CHANGED',
  target_type: 'USER',
  target_id: 9,
  details: { from: 'STUDENT', to: 'CLUB_HEAD' },
  ip_address: '10.0.0.1',
  created_at: '2026-09-16T05:00:00.000Z',
  admin_name: 'Nishanti Naidu',
  admin_email: 'gaurav.coordinator.it@mmcoe.edu.in',
  role_key: 'DEPT_COORDINATOR',
  ...overrides,
});

describe('toEntry', () => {
  it('reads a row back as a sentence with its actor', () => {
    expect(audit.toEntry(row())).toMatchObject({
      id: '42',
      action: 'ROLE_CHANGED',
      label: 'Changed a role',
      group: 'ROLES',
      subjectType: 'USER',
      subjectId: 9,
      ip: '10.0.0.1',
      actor: { id: 2, fullName: 'Nishanti Naidu', role: 'DEPT_COORDINATOR' },
    });
  });

  it('keeps the id as a string - log_id is a bigint', () => {
    expect(audit.toEntry(row({ log_id: '9007199254740993' })).id).toBe('9007199254740993');
  });

  it('still shows an action it does not recognise, rather than hiding it', () => {
    // A historical row from an older version must never vanish from an audit.
    const entry = audit.toEntry(row({ action: 'SOMETHING_OLD' }));
    expect(entry).toMatchObject({ action: 'SOMETHING_OLD', label: 'SOMETHING_OLD', group: 'OTHER' });
  });

  it('describes every action the application can write', () => {
    for (const action of Object.values(audit.ACTIONS)) {
      expect(audit.ACTION_META[action]).toBeDefined();
      expect(audit.GROUPS).toContain(audit.ACTION_META[action].group);
    }
  });

  it('records the five things FR20 names', () => {
    const { ACTIONS } = audit;
    expect(ACTIONS.USER_LOGIN).toBeDefined();           // user logins
    expect(ACTIONS.ROLE_CHANGED).toBeDefined();          // role modifications
    expect(ACTIONS.BOOKING_APPROVED).toBeDefined();      // event approvals
    expect(ACTIONS.BOOKING_DIRECT).toBeDefined();        // administrative overrides
    expect(ACTIONS.VENUE_UPDATED).toBeDefined();         // venue decisions
  });
});

describe('recordLogin', () => {
  it('writes a login with the address it came from', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    expect(await audit.recordLogin({ userId: 7, ip: '10.0.0.1', userAgent: 'Firefox' }, client)).toBe(true);

    const [, params] = client.query.mock.calls[0];
    expect(params[0]).toBe(7);
    expect(params[2]).toBe('USER_LOGIN');
    expect(JSON.parse(params[5])).toEqual({ userAgent: 'Firefox' });
  });

  it('never lets a failed write break the sign-in', async () => {
    const client = { query: jest.fn().mockRejectedValue(new Error('disk full')) };
    // The alternative - refusing entry because the trail could not be
    // written - would turn an audit problem into an outage.
    await expect(audit.recordLogin({ userId: 7 }, client)).resolves.toBe(false);
  });

  it('truncates an absurd user agent rather than storing it whole', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    await audit.recordLogin({ userId: 7, userAgent: 'x'.repeat(5000) }, client);
    expect(JSON.parse(client.query.mock.calls[0][1][5]).userAgent).toHaveLength(200);
  });

  it('copes with no address and no user agent', async () => {
    const client = { query: jest.fn().mockResolvedValue({}) };
    await audit.recordLogin({ userId: 7 }, client);
    const [, params] = client.query.mock.calls[0];
    expect(params[6]).toBeNull();
    expect(JSON.parse(params[5])).toEqual({ userAgent: null });
  });
});
