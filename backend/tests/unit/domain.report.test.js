'use strict';

jest.mock('../../src/services/reports/metrics.service', () => ({
  venueUtilisation: jest.fn(),
  clubActivity: jest.fn(),
  attendance: jest.fn(),
  resolvePeriod: jest.fn(() => ({ from: '2026-09-01', to: '2026-09-30', days: 30 })),
}));
jest.mock('../../src/services/audit.service', () => ({ listAll: jest.fn() }));

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Report, ReportResult } = require('../../src/domain/Report');
const catalogue = require('../../src/services/reports/catalogue');
const metrics = require('../../src/services/reports/metrics.service');
const audit = require('../../src/services/audit.service');
const ApiError = require('../../src/utils/ApiError');
const { parseCli } = require('../../scripts/export-report');

const principal = { id: 1, role: 'SUPER_ADMIN', departmentId: null, fullName: 'Principal' };
const coordinator = { id: 2, role: 'DEPT_COORDINATOR', departmentId: 4, fullName: 'Coordinator' };
const spec = { key: 'demo', title: 'Demo', description: 'A demo report.', columns: [{ key: 'name', label: 'Name' }, { key: 'n', label: 'Count', align: 'right' }] };
const period = { from: '2026-09-01', to: '2026-09-30', days: 30 };

describe('Report (abstract)', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new Report(spec)).toThrow(TypeError);
    expect(() => new Report(spec)).toThrow(/abstract/);
  });

  it('a subclass that forgets build() fails loudly, naming itself', async () => {
    class Forgetful extends Report { constructor() { super(spec); } }
    await expect(new Forgetful().run(principal)).rejects.toThrow('Forgetful must implement build()');
  });

  it('exposes its description read-only, from #private state', () => {
    class Demo extends Report { constructor() { super(spec); } }
    const report = new Demo();
    expect([report.key, report.title, report.description, report.columns]).toEqual(['demo', 'Demo', 'A demo report.', spec.columns]);
    expect(() => { report.title = 'Hacked'; }).toThrow(TypeError);
    expect(Object.keys(report)).toEqual([]);
  });

  describe('run() is a template method', () => {
    it('checks permission first, then builds, then wraps the outcome', async () => {
      const order = [];
      class Ordered extends Report {
        constructor() { super(spec); }

        assertAllowed() { order.push('assertAllowed'); }

        async build(actor, filters) { order.push(`build:${filters.q}`); return { rows: [{ name: 'a', n: 1 }], totals: { n: 1 }, period }; }
      }
      const result = await new Ordered().run(principal, { q: 'x' });
      expect(order).toEqual(['assertAllowed', 'build:x']);
      expect(result).toBeInstanceOf(ReportResult);
      expect(result.rows).toEqual([{ name: 'a', n: 1 }]);
    });

    it('never builds when the permission check throws', async () => {
      const build = jest.fn();
      class Guarded extends Report {
        constructor() { super(spec); }

        assertAllowed() { throw ApiError.forbidden('no'); }

        build(...args) { return build(...args); }
      }
      await expect(new Guarded().run(coordinator)).rejects.toBeInstanceOf(ApiError.ForbiddenError);
      expect(build).not.toHaveBeenCalled();
    });

    it('defaults filters to an empty object', async () => {
      class Plain extends Report {
        constructor() { super(spec); }

        async build(actor, filters) { return { rows: [], totals: {}, period, filters }; }
      }
      await expect(new Plain().run(principal)).resolves.toBeInstanceOf(ReportResult);
    });
  });
});

describe('the report catalogue: polymorphism over one type', () => {
  it('holds four Reports', () => {
    const all = Object.values(catalogue.REPORTS);
    expect(all).toHaveLength(4);
    expect(all.every((r) => r instanceof Report)).toBe(true);
    expect(all.map((r) => r.key)).toEqual(['venue-utilisation', 'club-activity', 'attendance', 'audit-trail']);
    expect(catalogue.get('attendance')).toBeInstanceOf(catalogue.AttendanceReport);
    expect(catalogue.get('nope')).toBeUndefined();
  });

  it('answers isVisibleTo differently per class: only the audit trail is restricted', () => {
    expect(catalogue.visibleTo(principal).map((r) => r.key)).toEqual(['venue-utilisation', 'club-activity', 'attendance', 'audit-trail']);
    expect(catalogue.visibleTo(coordinator).map((r) => r.key)).toEqual(['venue-utilisation', 'club-activity', 'attendance']);
  });

  it('refuses the audit trail to a coordinator by overriding assertAllowed', async () => {
    const trail = catalogue.get('audit-trail');
    await expect(trail.run(coordinator)).rejects.toMatchObject({ statusCode: 403, message: /Principal/ });
    expect(audit.listAll).not.toHaveBeenCalled();
  });

  it.each([
    ['venue-utilisation', 'venueUtilisation'],
    ['club-activity', 'clubActivity'],
    ['attendance', 'attendance'],
  ])('%s delegates build() to metrics.%s with the actor and filters', async (key, method) => {
    metrics[method].mockResolvedValueOnce({ rows: [{ id: 1 }], totals: { t: 1 }, period });
    const result = await catalogue.get(key).run(coordinator, { departmentId: 4 });
    expect(metrics[method]).toHaveBeenCalledWith(coordinator, { departmentId: 4 });
    expect(result.rows).toEqual([{ id: 1 }]);
    expect(result.toJSON().report).toBe(key);
  });

  it('builds the audit trail from audit entries', async () => {
    audit.listAll.mockResolvedValueOnce([
      { at: '2026-09-19T10:20:30.000Z', actor: { fullName: 'Asha', role: 'STUDENT' }, label: 'Signed in', subjectType: 'USER', subjectId: 5, ip: '1.2.3.4' },
      { at: '2026-09-19T11:00:00.000Z', actor: { fullName: 'Ravi', role: 'SUPER_ADMIN' }, label: 'Approved', subjectType: null, subjectId: null, ip: null },
    ]);
    const result = await catalogue.get('audit-trail').run(principal, { q: 'x' });
    expect(result.rows).toEqual([
      { at: '2026-09-19 10:20:30', actor: 'Asha', role: 'STUDENT', label: 'Signed in', subject: 'USER 5', ip: '1.2.3.4' },
      { at: '2026-09-19 11:00:00', actor: 'Ravi', role: 'SUPER_ADMIN', label: 'Approved', subject: '', ip: '' },
    ]);
    expect(result.totals).toEqual({ entries: 2 });
    expect(result.period).toEqual(period);
  });

  it('gives an entry with a subject type but no id a clean subject', async () => {
    audit.listAll.mockResolvedValueOnce([
      { at: '2026-09-19T10:20:30.000Z', actor: { fullName: 'A', role: 'STUDENT' }, label: 'X', subjectType: 'EVENT', subjectId: null, ip: null },
    ]);
    const result = await catalogue.get('audit-trail').run(principal);
    expect(result.rows[0].subject).toBe('EVENT');
  });
});

describe('ReportResult', () => {
  class Demo extends Report { constructor() { super(spec); } }
  const result = () => new ReportResult({
    report: new Demo(), rows: [{ name: 'Alpha, Inc', n: 3 }, { name: '=EVIL()', n: 0 }], totals: { n: 3 }, period,
  });
  let dir;

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'campusos-report-')); });

  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('presents itself as JSON', () => {
    expect(result().toJSON()).toEqual({
      report: 'demo', title: 'Demo', columns: spec.columns,
      rows: [{ name: 'Alpha, Inc', n: 3 }, { name: '=EVIL()', n: 0 }], totals: { n: 3 }, period,
    });
    expect(JSON.parse(JSON.stringify(result())).report).toBe('demo');
  });

  it('presents itself as CSV, with the injection guard, and a BOM only on request', () => {
    const csv = result().toCsv();
    expect(csv.startsWith('Name,Count\r\n')).toBe(true);
    expect(csv).toContain('"Alpha, Inc",3');
    expect(csv).toContain('"\t=EVIL()",0');
    expect(result().toCsv({ bom: true }).charCodeAt(0)).toBe(0xFEFF);
  });

  it('names its file from the report key and date', () => {
    expect(result().fileName('csv', '2026-09-19')).toBe('campusos-demo-2026-09-19.csv');
    expect(result().report).toBeInstanceOf(Demo);
  });

  describe('saveTo (file I/O with fs)', () => {
    const meta = { today: '2026-09-19' };

    it('writes a CSV file, creating the directory', async () => {
      const nested = path.join(dir, 'a', 'b');
      const file = await result().saveTo(nested, 'csv', meta);
      expect(file).toBe(path.join(nested, 'campusos-demo-2026-09-19.csv'));
      const text = fs.readFileSync(file, 'utf8');
      expect(text.charCodeAt(0)).toBe(0xFEFF);
      expect(text).toContain('Name,Count');
    });

    it('writes a JSON file that parses back to the same report', async () => {
      const file = await result().saveTo(dir, 'json', meta);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(result().toJSON());
    });

    it('streams a real PDF and resolves only once the file is complete', async () => {
      const file = await result().saveTo(dir, 'pdf', { ...meta, generatedBy: 'Tester', generatedAt: '2026-09-19 10:00' });
      const bytes = fs.readFileSync(file);
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      expect(bytes.subarray(-6).toString()).toContain('%%EOF');
    });

    it('uses defaults when no author is given', async () => {
      await expect(result().saveTo(dir, 'pdf', meta)).resolves.toMatch(/\.pdf$/);
    });

    it('refuses a format it cannot write', async () => {
      await expect(result().saveTo(dir, 'xml', meta)).rejects.toThrow(RangeError);
      expect(fs.readdirSync(dir)).toEqual([]);
    });

    it('rejects when the file cannot be written', async () => {
      const blocker = path.join(dir, 'file.txt');
      fs.writeFileSync(blocker, 'x');
      await expect(result().saveTo(path.join(blocker, 'sub'), 'csv', meta)).rejects.toThrow();
      await expect(result().saveTo(path.join(blocker, 'sub'), 'pdf', meta)).rejects.toThrow();
    });
  });
});

describe('the export CLI argument parser', () => {
  it('defaults to CSV in ./exports', () => {
    expect(parseCli(['attendance'])).toEqual({
      report: 'attendance', format: 'csv', filters: { from: undefined, to: undefined }, out: path.resolve('./exports'),
    });
  });

  it('reads the options', () => {
    expect(parseCli(['club-activity', '--format', 'pdf', '--from', '2026-08-01', '--to', '2026-08-31', '--out', '/tmp/x']))
      .toEqual({ report: 'club-activity', format: 'pdf', filters: { from: '2026-08-01', to: '2026-08-31' }, out: '/tmp/x' });
  });

  it.each([
    [[], /Choose a report/],
    [['attendance', '--format', 'xml'], /Unknown format "xml"/],
    [['attendance', '--from', 'yesterday'], /--from must be YYYY-MM-DD/],
    [['attendance', '--to', '2026-9-1'], /--to must be YYYY-MM-DD/],
  ])('rejects %j', (argv, message) => {
    expect(() => parseCli(argv)).toThrow(message);
  });
});
