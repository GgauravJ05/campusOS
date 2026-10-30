'use strict';

jest.mock('../../src/config/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../../src/services/mail/mailer');

const db = require('../../src/config/db');
const mailer = require('../../src/services/mail/mailer');
const rbac = require('../../src/services/rbac');
const templates = require('../../src/services/mail/templates');
const notifications = require('../../src/services/notifications/notification.service');
const bookings = require('../../src/services/bookings/booking.service');

const principal = { id: 1, role: 'SUPER_ADMIN', departmentId: 1 };
const itCoordinator = { id: 2, role: 'DEPT_COORDINATOR', departmentId: 1 };
const orphanCoordinator = { id: 3, role: 'DEPT_COORDINATOR', departmentId: null };
const head = { id: 4, role: 'CLUB_HEAD', departmentId: 1 };
const student = { id: 5, role: 'STUDENT', departmentId: 1 };

describe('club administration policy (FR11)', () => {
  const itClub = { departmentId: 1, headId: 4 };
  const csClub = { departmentId: 2, headId: 9 };
  const collegeClub = { departmentId: null, headId: 4 };

  it('lets the principal manage every club, including college-level ones', () => {
    [itClub, csClub, collegeClub].forEach((club) => expect(rbac.canManageClub(principal, club)).toBe(true));
  });

  it('limits a coordinator to their own department and never college-level clubs', () => {
    expect(rbac.canManageClub(itCoordinator, itClub)).toBe(true);
    expect(rbac.canManageClub(itCoordinator, csClub)).toBe(false);
    expect(rbac.canManageClub(itCoordinator, collegeClub)).toBe(false);
    expect(rbac.canManageClub(orphanCoordinator, { departmentId: null, headId: null })).toBe(false);
  });

  it('never lets students or club heads administer a club', () => {
    expect(rbac.canManageClub(head, itClub)).toBe(false);
    expect(rbac.canManageClub(student, itClub)).toBe(false);
  });

  it('lets a club head run their own club, college-level or not, and nobody else\'s', () => {
    expect(rbac.canRunClub(head, itClub)).toBe(true);
    expect(rbac.canRunClub(head, collegeClub)).toBe(true);
    expect(rbac.canRunClub(head, csClub)).toBe(false);
    expect(rbac.canRunClub(student, { departmentId: 1, headId: null })).toBe(false);
    expect(rbac.canRunClub(itCoordinator, { departmentId: 1, headId: null })).toBe(true);
  });
});

describe('request editing policy (FR13)', () => {
  it('lets the requester or the current club head edit, never faculty', () => {
    const row = { requested_by: 4, club_head_id: 7 };
    expect(bookings.canEdit(head, row)).toBe(true);
    expect(bookings.canEdit({ id: 7, role: 'CLUB_HEAD' }, row)).toBe(true);
    expect(bookings.canEdit(itCoordinator, row)).toBe(false);
    expect(bookings.canEdit({ id: 8, role: 'CLUB_HEAD' }, { requested_by: 4, club_head_id: null })).toBe(false);
  });
});

describe('booking outcome emails', () => {
  const base = {
    fullName: 'Asha', bookingId: 42, title: 'Hack <Night>', venueName: 'Seminar Hall A', date: '2026-10-01', startTime: '10:00', endTime: '12:00',
  };

  it.each([
    ['APPROVED', '"Hack <Night>" approved'],
    ['REJECTED', '"Hack <Night>" not approved'],
    ['CHANGES_REQUESTED', '"Hack <Night>" needs changes'],
    ['CANCELLED', '"Hack <Night>" cancelled'],
  ])('%s has its own subject and links to the request', (outcome, subject) => {
    const mail = templates.bookingOutcome({ ...base, outcome });
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain('/bookings?focus=42');
    expect(mail.html).toContain('Hack &lt;Night&gt;');
    expect(mail.html).not.toContain('<Night>');
  });

  it('shows the note only for outcomes that carry one, and credits the decider', () => {
    const rejected = templates.bookingOutcome({ ...base, outcome: 'REJECTED', note: 'Exam week', deciderName: 'Nishanti Naidu' });
    expect(rejected.text).toContain('Reason: Exam week');
    expect(rejected.text).toContain('(by Nishanti Naidu)');

    const approved = templates.bookingOutcome({ ...base, outcome: 'APPROVED', note: 'ignored' });
    expect(approved.text).not.toContain('ignored');
    expect(approved.html).not.toContain('ignored');
  });

  it('welcomes a new team member with a readable position', () => {
    const mail = templates.addedToClub({ fullName: 'Asha', clubName: 'DSC', position: 'TECHNICAL_LEAD', addedBy: 'Gaurav' });
    expect(mail.subject).toBe('You were added to DSC');
    expect(mail.text).toContain('as technical lead');
  });
});

describe('notification service helpers', () => {
  it('writes nothing for an empty or recipient-less batch', async () => {
    const client = { query: jest.fn() };
    await notifications.notify(client, []);
    await notifications.notify(client, [null, { userId: null, category: 'GENERAL', title: 't', message: 'm' }]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('writes a batch as one multi-row insert with optional links left null', async () => {
    const client = { query: jest.fn() };
    await notifications.notify(client, [
      { userId: 1, category: 'GENERAL', title: 'x'.repeat(250), message: 'one' },
      { userId: 2, category: 'BOOKING_APPROVED', title: 'two', message: 'two', bookingId: 9, eventId: 8 },
    ]);
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)');
    expect(params[2]).toHaveLength(200);
    expect(params.slice(4, 6)).toEqual([null, null]);
    expect(params.slice(10, 12)).toEqual([9, 8]);
  });

  it('sends every queued email in the background', () => {
    notifications.flush([{ to: 'a@x' }, { to: 'b@x' }]);
    expect(mailer.sendMailInBackground).toHaveBeenCalledTimes(2);
  });

  it('clamps paging and falls back to defaults for junk values', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ unread: 0 }] });
    const result = await notifications.listForUser(1, { page: 'abc', pageSize: 0 });
    expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0, unread: 0 });
    expect(db.query.mock.calls[0][0]).toContain('LIMIT 20 OFFSET 0');

    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ unread: 3 }] });
    const big = await notifications.listForUser(1, { page: 3, pageSize: 999 });
    expect(big.meta).toMatchObject({ page: 3, pageSize: notifications.MAX_PAGE_SIZE, unread: 3 });
  });

  it('uses defaults when called with no filters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ unread: 0 }] });
    await notifications.listForUser(1);
    expect(db.query.mock.calls[0][1]).toEqual([1, false]);
  });
});
