'use strict';

/**
 * Password policy and hashing.
 *
 * The policy follows NIST SP 800-63B in spirit - length matters most - with
 * a light character-variety rule students recognise, plus a block-list of
 * the passwords attackers try first.
 */

const bcrypt = require('bcrypt');
const config = require('../../config');

const MIN_LENGTH = 8;
/** bcrypt silently ignores everything past 72 bytes, so refuse longer input. */
const MAX_BYTES = 72;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', '12345678', '123456789',
  '1234567890', 'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123', 'welcome1',
  'welcome123', 'letmein1', 'abc12345', 'campus123', 'campus@123', 'mmcoe123',
  'mmcoe@123', 'student123', 'college123', 'india@123', 'pune@123',
]);

/**
 * @param {string} password
 * @param {{ email?: string, fullName?: string }} [context]
 * @returns {string[]} human-readable problems; empty when acceptable
 */
function checkPasswordPolicy(password, { email = '', fullName = '' } = {}) {
  if (typeof password !== 'string') return ['Password is required'];

  const problems = [];
  if (password.length < MIN_LENGTH) problems.push(`Use at least ${MIN_LENGTH} characters`);
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) problems.push(`Use at most ${MAX_BYTES} bytes`);

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    problems.push('Mix at least three of: lowercase, uppercase, numbers, symbols');
  }

  const lowered = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) problems.push('This password is too common');

  const localPart = email.split('@')[0].toLowerCase();
  if (localPart.length >= 4 && lowered.includes(localPart)) {
    problems.push('Do not include your email address');
  }
  const nameParts = fullName.toLowerCase().split(/\s+/).filter((part) => part.length >= 4);
  if (nameParts.some((part) => lowered.includes(part))) {
    problems.push('Do not include your name');
  }

  return problems;
}

function hashPassword(password) {
  return bcrypt.hash(password, config.security.bcryptRounds);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * A real hash of a random string, compared against when the email is not
 * registered. Makes "no such user" take as long as "wrong password", so
 * response time does not reveal which accounts exist.
 */
const DUMMY_HASH = bcrypt.hashSync(`dummy-${Date.now()}-${Math.random()}`, config.security.bcryptRounds);

module.exports = { checkPasswordPolicy, hashPassword, verifyPassword, DUMMY_HASH, MIN_LENGTH, MAX_BYTES };
