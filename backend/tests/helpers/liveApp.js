'use strict';

/**
 * Builds the real application wired to the real test database, for the
 * end-to-end suites. Require this AFTER jest.mock() of the mailer.
 *
 *   jest.mock('../../src/services/mail/mailer');
 *   const live = require('../helpers/liveApp');
 */

const connectionString = process.env.TEST_DATABASE_URL;

// Point the application's own pool at the test database. Config is read on
// first require, and each test file has its own module registry.
if (connectionString) process.env.DATABASE_URL = connectionString;

const supertest = require('supertest');
const createApp = require('../../src/app');
const db = require('../../src/config/db');
const mailer = require('../../src/services/mail/mailer');
const config = require('../../src/config');

const describeWithDb = connectionString ? describe : describe.skip;

const servers = new WeakMap();

/**
 * `supertest(app)`, but against one long-lived listening server per app.
 *
 * Handing supertest a bare app makes it start a fresh server for every request
 * and close it afterwards, and that occasionally resets the connection
 * (`ECONNRESET` / "socket hang up"): measured at about 1 request in 8,000, with
 * no application code involved (0 in 60,000 requests against a shared server,
 * 7 in 60,000 per-request). A suite makes thousands of requests, so it failed a
 * different test in roughly one full run in six. The server is unref'd so it
 * never keeps Jest alive.
 */
function request(app) {
  if (typeof app !== 'function') return supertest(app);
  let server = servers.get(app);
  if (!server) {
    server = app.listen(0);
    server.unref();
    servers.set(app, server);
  }
  return supertest(server);
}

let counter = 0;
/** A unique, allowed-domain email per call, so suites never collide. */
function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}.${Date.now().toString(36)}${counter}.${process.pid}@mmcoe.edu.in`;
}

/** Every mail "sent" (captured by the mailer mock), newest last. */
function sentMail(to) {
  const calls = [...mailer.sendMailInBackground.mock.calls, ...(mailer.sendMail.mock?.calls || [])];
  return calls.map(([message]) => message).filter((message) => !to || message.to === to);
}

/** The 6-digit code from the newest email to `to`. */
function latestCode(to) {
  const mails = sentMail(to);
  for (let i = mails.length - 1; i >= 0; i -= 1) {
    const match = /\b(\d{6})\b/.exec(mails[i].text);
    if (match) return match[1];
  }
  throw new Error(`No code has been emailed to ${to}`);
}

/** Extracts the refresh cookie value from a supertest response. */
function refreshCookie(res) {
  const cookies = res.headers['set-cookie'] || [];
  const cookie = cookies.find((c) => c.startsWith(`${config.auth.refreshCookieName}=`));
  return cookie ? cookie.split(';')[0] : null;
}

async function departmentId(code = 'IT') {
  const { rows } = await db.query('SELECT department_id FROM departments WHERE dept_code = $1', [code]);
  return rows[0].department_id;
}

/**
 * Registers and verifies a student through the public API.
 * @returns {Promise<{ email: string, password: string, accessToken: string, cookie: string, user: object }>}
 */
async function createVerifiedStudent(app, { dept = 'IT', password = 'Violet-Lantern-42', fullName = 'Test Student' } = {}) {
  const email = uniqueEmail('student');
  await request(app).post('/api/auth/register').send({
    fullName, email, password, departmentId: await departmentId(dept), academicYear: 2,
  }).expect(202);

  const res = await request(app).post('/api/auth/verify-email').send({ email, code: latestCode(email) }).expect(200);
  return { email, password, accessToken: res.body.data.accessToken, cookie: refreshCookie(res), user: res.body.data.user };
}

/** Signs in a seeded account (password Campus@123). */
async function signIn(app, email, password = 'Campus@123') {
  const res = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  return { accessToken: res.body.data.accessToken, cookie: refreshCookie(res), user: res.body.data.user };
}

module.exports = {
  request,
  createApp,
  db,
  mailer,
  config,
  describeWithDb,
  uniqueEmail,
  sentMail,
  latestCode,
  refreshCookie,
  departmentId,
  createVerifiedStudent,
  signIn,
};
