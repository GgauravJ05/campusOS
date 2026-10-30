'use strict';

/**
 * FR21 reports as classes.
 *
 * `Report` is abstract: it defines what every report has (a description of
 * its columns, a rule for who may see it, a `build` step) and how a run is
 * sequenced, but not how any particular report gets its rows. Concrete
 * reports (services/reports/catalogue.js) extend it and override the parts
 * that differ:
 *
 *   build(actor, filters)   abstract - how this report's rows are produced
 *   isVisibleTo(actor)      default true; the audit trail overrides it
 *   assertAllowed(actor)    default no-op; the audit trail overrides it
 *
 * `run` is a template method: check permission, build, wrap the outcome. The
 * outcome is a `ReportResult`, which knows how to present itself as JSON,
 * CSV or PDF and how to write itself to disk with `fs` - so a caller holds
 * one object and asks it for a format, rather than passing rows, columns and
 * totals around separately.
 */

const fs = require('node:fs');
const path = require('node:path');
const format = require('../services/reports/format');
const pdf = require('../services/reports/pdf');

class Report {
  #spec;

  /** @param {import('../services/reports/format').ReportSpec} spec */
  constructor(spec) {
    if (new.target === Report) throw new TypeError('Report is abstract; extend it');
    this.#spec = spec;
  }

  get key() { return this.#spec.key; }

  get title() { return this.#spec.title; }

  get description() { return this.#spec.description; }

  get columns() { return this.#spec.columns; }

  /** Whether this report appears in a person's catalogue. */
  isVisibleTo() { return true; }

  /** Throws if `actor` may not run this report. */
  assertAllowed() {}

  /**
   * @abstract
   * @returns {Promise<{ rows: object[], totals: object, period: object }>}
   */
  async build() {
    throw new Error(`${this.constructor.name} must implement build()`);
  }

  /** Template method: permission, then build, then wrap. */
  async run(actor, filters = {}) {
    this.assertAllowed(actor);
    const { rows, totals, period } = await this.build(actor, filters);
    return new ReportResult({ report: this, rows, totals, period });
  }
}

/** The extension each format is saved with. */
const EXTENSIONS = Object.freeze({ json: 'json', csv: 'csv', pdf: 'pdf' });

class ReportResult {
  #report;

  /** @param {{ report: Report, rows: object[], totals: object, period: object }} data */
  constructor({ report, rows, totals, period }) {
    this.#report = report;
    this.rows = rows;
    this.totals = totals;
    this.period = period;
  }

  get report() { return this.#report; }

  toJSON() {
    const { key, title, columns } = this.#report;
    return { report: key, title, columns, rows: this.rows, totals: this.totals, period: this.period };
  }

  /** @param {{ bom?: boolean }} [options] a BOM makes Excel read UTF-8 names correctly */
  toCsv({ bom = false } = {}) {
    return `${bom ? '﻿' : ''}${format.toCsv(this.rows, this.#report.columns)}`;
  }

  /**
   * Streams a PDF into `stream`.
   * @param {NodeJS.WritableStream} stream
   * @param {{ generatedBy: string, generatedAt: string }} meta
   */
  toPdf(stream, { generatedBy, generatedAt }) {
    return pdf.render({
      spec: this.#report, rows: this.rows, totals: this.totals, period: this.period, generatedBy, generatedAt,
    }, stream);
  }

  fileName(extension, today) {
    return format.fileName(this.#report.key, extension, today);
  }

  /**
   * Writes this report to `directory` (created if missing) and resolves to the
   * file's path. CSV and JSON are written in one call; PDF is streamed to a
   * file stream and the promise waits for the file to be fully flushed.
   *
   * @param {string} directory
   * @param {'json'|'csv'|'pdf'} kind
   * @param {{ today: string, generatedBy?: string, generatedAt?: string }} meta
   */
  async saveTo(directory, kind, { today, generatedBy = 'CampusOS', generatedAt = today }) {
    if (!(kind in EXTENSIONS)) throw new RangeError(`Cannot save a report as ${kind}`);
    await fs.promises.mkdir(directory, { recursive: true });
    const file = path.join(directory, this.fileName(EXTENSIONS[kind], today));

    if (kind === 'csv') {
      await fs.promises.writeFile(file, this.toCsv({ bom: true }), 'utf8');
    } else if (kind === 'json') {
      await fs.promises.writeFile(file, `${JSON.stringify(this.toJSON(), null, 2)}\n`, 'utf8');
    } else {
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(file);
        out.on('finish', resolve);
        out.on('error', reject);
        this.toPdf(out, { generatedBy, generatedAt });
      });
    }
    return file;
  }
}

module.exports = { Report, ReportResult };
