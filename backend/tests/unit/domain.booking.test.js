'use strict';

const Booking = require('../../src/domain/Booking');
const ApiError = require('../../src/utils/ApiError');

const { STATUSES: S } = Booking;
const NOW = Date.parse('2031-06-01T09:00:00Z');
const future = '2031-06-02T09:00:00Z';
const past = '2031-05-31T09:00:00Z';
const make = (status, startAt = future) => new Booking({ id: 7, status, startAt });

/** action -> the statuses it may start from, and where it ends. */
const LEGAL = {
  approve: { from: [S.PENDING], to: S.APPROVED },
  requestChanges: { from: [S.PENDING], to: S.MODIFICATION_REQUESTED },
  reject: { from: [S.PENDING, S.MODIFICATION_REQUESTED], to: S.REJECTED },
  resubmit: { from: [S.PENDING, S.MODIFICATION_REQUESTED], to: S.PENDING },
  cancel: { from: [S.PENDING, S.APPROVED, S.MODIFICATION_REQUESTED], to: S.CANCELLED },
};
const ALL = Object.values(S);

describe('Booking lifecycle', () => {
  describe.each(Object.entries(LEGAL))('%s()', (action, { from, to }) => {
    it.each(from)(`moves %s to ${to}`, (status) => {
      const booking = make(status);
      expect(booking[action](NOW)).toBe(booking); // returns itself, so calls chain
      expect(booking.status).toBe(to);
    });

    it.each(ALL.filter((status) => !from.includes(status)))('is refused from %s, leaving it unchanged', (status) => {
      const booking = make(status);
      expect(() => booking[action](NOW)).toThrow(ApiError.ConflictError);
      expect(booking.status).toBe(status);
    });

    it('is refused once the event has started, leaving the status unchanged', () => {
      const booking = make(from[0], past);
      expect(() => booking[action](NOW)).toThrow(ApiError.ConflictError);
      expect(booking.status).toBe(from[0]);
    });
  });

  it('can be chained through a whole journey', () => {
    const booking = make(S.PENDING);
    booking.requestChanges(NOW).resubmit(NOW).approve(NOW).cancel(NOW);
    expect(booking.status).toBe(S.CANCELLED);
  });

  it('treats REJECTED and CANCELLED as final: nothing leaves them', () => {
    for (const status of [S.REJECTED, S.CANCELLED]) {
      for (const action of Object.keys(LEGAL)) {
        expect(() => make(status)[action](NOW)).toThrow(ApiError);
      }
    }
  });

  describe('the errors match what the service used to throw', () => {
    const catchError = (fn) => { try { fn(); } catch (err) { return err; } return null; };

    it('names a decided request BOOKING_NOT_PENDING, in words', () => {
      const err = catchError(() => make(S.APPROVED).approve(NOW));
      expect(err).toMatchObject({ statusCode: 409, code: 'BOOKING_NOT_PENDING', message: 'This request is already approved' });
      expect(catchError(() => make(S.MODIFICATION_REQUESTED).approve(NOW)).message)
        .toBe('This request is already modification requested');
    });

    it('names a past request BOOKING_EXPIRED', () => {
      expect(catchError(() => make(S.PENDING, past).approve(NOW)))
        .toMatchObject({ code: 'BOOKING_EXPIRED', message: 'This request is for a time that has passed' });
    });

    it('names an uneditable request BOOKING_NOT_EDITABLE', () => {
      expect(catchError(() => make(S.APPROVED).resubmit(NOW)))
        .toMatchObject({ code: 'BOOKING_NOT_EDITABLE', message: 'This request is already approved and can no longer be edited' });
    });

    it('names a dead booking BOOKING_NOT_LIVE and a started one BOOKING_STARTED', () => {
      expect(catchError(() => make(S.REJECTED).cancel(NOW)))
        .toMatchObject({ code: 'BOOKING_NOT_LIVE', message: 'This booking is already rejected' });
      expect(catchError(() => make(S.APPROVED, past).cancel(NOW)))
        .toMatchObject({ code: 'BOOKING_STARTED', message: 'An event that has started cannot be cancelled' });
    });

    it('checks the state before the time, as the service did', () => {
      // Rejected AND in the past: the state is what is reported.
      expect(catchError(() => make(S.REJECTED, past).approve(NOW)).code).toBe('BOOKING_NOT_PENDING');
    });
  });

  describe('the canX questions mirror the actions', () => {
    it.each(Object.entries({
      canApprove: 'approve', canRequestChanges: 'requestChanges', canReject: 'reject',
      canResubmit: 'resubmit', canCancel: 'cancel',
    }))('%s() is true exactly when %s() would succeed', (question, action) => {
      for (const status of ALL) {
        for (const startAt of [future, past]) {
          const asked = make(status, startAt)[question](NOW);
          let succeeded = true;
          try { make(status, startAt)[action](NOW); } catch { succeeded = false; }
          expect(asked).toBe(succeeded);
        }
      }
    });

    it('does not change the booking when asked', () => {
      const booking = make(S.PENDING);
      booking.canApprove(NOW);
      expect(booking.status).toBe(S.PENDING);
    });
  });

  describe('status groups', () => {
    it('reports live and open', () => {
      expect([S.PENDING, S.APPROVED, S.MODIFICATION_REQUESTED].map((s) => make(s).isLive)).toEqual([true, true, true]);
      expect([S.REJECTED, S.CANCELLED].map((s) => make(s).isLive)).toEqual([false, false]);
      expect(make(S.PENDING).isOpen).toBe(true);
      expect(make(S.APPROVED).isOpen).toBe(false);
      expect(Booking.LIVE_STATUSES).toEqual(['PENDING', 'APPROVED', 'MODIFICATION_REQUESTED']);
      expect(Booking.OPEN_STATUSES).toEqual(['PENDING', 'MODIFICATION_REQUESTED']);
    });

    it('measures "started" against the clock when no time is given', () => {
      expect(make(S.PENDING, '2000-01-01T00:00:00Z').hasStarted()).toBe(true);
      expect(make(S.PENDING, '2999-01-01T00:00:00Z').hasStarted()).toBe(false);
      expect(make(S.PENDING, '2999-01-01T00:00:00Z').canApprove()).toBe(true);
    });
  });

  describe('encapsulation', () => {
    it('keeps status in a #private field: it cannot be assigned, only moved by an action', () => {
      const booking = make(S.PENDING);
      expect(() => { booking.status = S.APPROVED; }).toThrow(TypeError);
      expect(() => { booking.id = 1; }).toThrow(TypeError);
      expect(booking.status).toBe(S.PENDING);
      expect(Object.keys(booking)).toEqual([]);
      expect(booking.id).toBe(7);
    });
  });

  describe('fromRow', () => {
    it('builds a Booking from a database row', () => {
      const booking = Booking.fromRow({ booking_id: 12, status: 'APPROVED', start_at: future, venue_id: 3 });
      expect(booking).toBeInstanceOf(Booking);
      expect(booking.id).toBe(12);
      expect(booking.status).toBe('APPROVED');
    });
  });
});
