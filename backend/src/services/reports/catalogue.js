'use strict';

/**
 * The four FR21 reports, as subclasses of the abstract `Report`
 * (domain/Report.js). Each overrides `build`; the audit trail also overrides
 * who may see it, which is what used to be an `if (reportKey === 'audit-trail')`
 * in the controller.
 */

const { Report } = require('../../domain/Report');
const ApiError = require('../../utils/ApiError');
const format = require('./format');
const metrics = require('./metrics.service');
const audit = require('../audit.service');

class VenueUtilisationReport extends Report {
  constructor() { super(format.REPORTS['venue-utilisation']); }

  build(actor, filters) { return metrics.venueUtilisation(actor, filters); }
}

class ClubActivityReport extends Report {
  constructor() { super(format.REPORTS['club-activity']); }

  build(actor, filters) { return metrics.clubActivity(actor, filters); }
}

class AttendanceReport extends Report {
  constructor() { super(format.REPORTS.attendance); }

  build(actor, filters) { return metrics.attendance(actor, filters); }
}

/** Comes from audit.service rather than the metrics service, and is the Principal's alone. */
class AuditTrailReport extends Report {
  constructor() { super(format.REPORTS['audit-trail']); }

  isVisibleTo(actor) { return actor.role === 'SUPER_ADMIN'; }

  assertAllowed(actor) {
    if (!this.isVisibleTo(actor)) throw ApiError.forbidden('The audit trail is limited to the Principal / HOD');
  }

  async build(actor, filters) {
    const entries = await audit.listAll(filters);
    return {
      rows: entries.map((entry) => ({
        at: new Date(entry.at).toISOString().replace('T', ' ').slice(0, 19),
        actor: entry.actor.fullName,
        role: entry.actor.role,
        label: entry.label,
        subject: entry.subjectType ? `${entry.subjectType} ${entry.subjectId ?? ''}`.trim() : '',
        ip: entry.ip ?? '',
      })),
      totals: { entries: entries.length },
      period: metrics.resolvePeriod(filters),
    };
  }
}

const REPORTS = Object.freeze({
  'venue-utilisation': new VenueUtilisationReport(),
  'club-activity': new ClubActivityReport(),
  attendance: new AttendanceReport(),
  'audit-trail': new AuditTrailReport(),
});

/** @returns {Report | undefined} */
function get(key) {
  return REPORTS[key];
}

/** The reports `actor` may see, in catalogue order. */
function visibleTo(actor) {
  return Object.values(REPORTS).filter((report) => report.isVisibleTo(actor));
}

module.exports = {
  REPORTS, get, visibleTo, VenueUtilisationReport, ClubActivityReport, AttendanceReport, AuditTrailReport,
};
