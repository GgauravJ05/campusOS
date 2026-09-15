'use strict';

jest.mock('../../src/config/db', () => ({ query: jest.fn(), withTransaction: jest.fn() }));

const db = require('../../src/config/db');
const bookings = require('../../src/services/bookings/booking.service');
const venues = require('../../src/services/venues/venue.service');
const settings = require('../../src/services/settings.service');

const principal = { id: 1, role: 'SUPER_ADMIN', departmentId: 1 };
const itCoordinator = { id: 2, role: 'DEPT_COORDINATOR', departmentId: 1 };
const orphanCoordinator = { id: 3, role: 'DEPT_COORDINATOR', departmentId: null };
const head = { id: 4, role: 'CLUB_HEAD', departmentId: 1 };

const itClubBooking = { event_scope: 'CLUB', event_department_id: 1, requested_by: 4, club_head_id: 4 };
const collegeBooking = { event_scope: 'COLLEGE', event_department_id: null, requested_by: 9, club_head_id: null };

describe('booking decision routing (FR12)', () => {
  it('lets the principal decide anything', () => {
    expect(bookings.canDecide(principal, collegeBooking)).toBe(true);
  });

  it('lets a coordinator decide their department only, never college-level', () => {
    expect(bookings.canDecide(itCoordinator, itClubBooking)).toBe(true);
    expect(bookings.canDecide(itCoordinator, { ...itClubBooking, event_department_id: 2 })).toBe(false);
    expect(bookings.canDecide(itCoordinator, collegeBooking)).toBe(false);
  });

  it('never lets a coordinator without a department decide', () => {
    expect(bookings.canDecide(orphanCoordinator, { ...itClubBooking, event_department_id: null, event_scope: 'CLUB' })).toBe(false);
  });

  it('never lets a club head decide, even on their own request', () => {
    expect(bookings.canDecide(head, itClubBooking)).toBe(false);
  });

  it('lets the requester, the club head, or the deciding faculty cancel', () => {
    expect(bookings.canCancel(head, itClubBooking)).toBe(true);
    expect(bookings.canCancel({ id: 7, role: 'CLUB_HEAD' }, { ...itClubBooking, requested_by: 8, club_head_id: 7 })).toBe(true);
    expect(bookings.canCancel(itCoordinator, itClubBooking)).toBe(true);
    expect(bookings.canCancel({ id: 99, role: 'STUDENT', departmentId: 1 }, itClubBooking)).toBe(false);
  });
});

describe('venue management scope', () => {
  it('lets the principal manage any venue and a coordinator only their department', () => {
    expect(venues.canManageVenue(principal, { department_id: 5 })).toBe(true);
    expect(venues.canManageVenue(itCoordinator, { department_id: 1 })).toBe(true);
    expect(venues.canManageVenue(itCoordinator, { department: { id: 1 } })).toBe(true);
    expect(venues.canManageVenue(itCoordinator, { department_id: null })).toBe(false);
    expect(venues.canManageVenue(orphanCoordinator, { department_id: null })).toBe(false);
    expect(venues.canManageVenue(head, { department_id: 1 })).toBe(false);
  });

  it('normalises equipment names into unique upper-case tokens', () => {
    expect(venues.normaliseEquipment([' smart board', 'Smart-Board', 'ac', '', 'AC'])).toEqual(['AC', 'SMART_BOARD']);
    expect(venues.normaliseEquipment()).toEqual([]);
  });
});

describe('scheduling settings', () => {
  it('reads configured values', async () => {
    db.query.mockResolvedValue({ rows: [
      { setting_key: 'venue.default_buffer_minutes', setting_value: '20' },
      { setting_key: 'venue.opening_time', setting_value: '08:00' },
    ] });
    await expect(settings.getSchedulingRules()).resolves.toMatchObject({ defaultBufferMinutes: 20, openingTime: '08:00', closingTime: '21:00' });
  });

  it('falls back to defaults for missing or corrupt values', async () => {
    db.query.mockResolvedValue({ rows: [{ setting_key: 'booking.max_advance_days', setting_value: 'lots' }] });
    await expect(settings.getSchedulingRules()).resolves.toMatchObject({ maxAdvanceDays: 90, defaultBufferMinutes: 15 });
  });

  it('uses the passed transaction client', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await settings.getSchedulingRules(client);
    expect(client.query).toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });
});
