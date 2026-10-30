'use strict';

/**
 * Authentication use cases (FR1, FR2, FR4).
 *
 * Account enumeration is designed out: register, resend-verification and
 * forgot-password answer identically whether or not the email has an
 * account, and emails are sent in the background so response time does not
 * differ either. Login compares against a dummy hash for unknown emails
 * for the same reason.
 */

const db = require('../../config/db');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const users = require('../users/user.repository');
const otp = require('./otp.service');
const sessions = require('./session.service');
const audit = require('../audit.service');
const mailer = require('../mail/mailer');
const templates = require('../mail/templates');
const { signAccessToken } = require('./tokens');
const { checkPasswordPolicy, hashPassword, verifyPassword, DUMMY_HASH } = require('./password');
const { ROLES } = require('../rbac');

const { PURPOSE } = otp;

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isAllowedDomain(email) {
  const allowed = config.auth.allowedEmailDomains;
  if (allowed.length === 0) return true;
  const domain = email.split('@').pop();
  return allowed.includes(domain);
}

function passwordPolicyError(password, context) {
  const problems = checkPasswordPolicy(password, context);
  if (problems.length === 0) return null;
  return ApiError.validation('Choose a stronger password', problems.map((message) => ({ field: 'password', message })));
}

/** Uniform answer for the enumeration-safe flows. */
function codeSentResponse(email) {
  return { email, resendAvailableInSeconds: config.auth.otpResendCooldownSeconds };
}

async function issueSession(userRow, context, client) {
  const session = await sessions.createSession({ userId: userRow.user_id, ...context }, client);
  return {
    accessToken: signAccessToken({ userId: userRow.user_id, familyId: session.familyId }),
    accessTokenExpiresIn: Math.floor(config.jwt.accessTokenTtlMs / 1000),
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.expiresAt,
  };
}

async function withUserPayload(userRow, tokens) {
  const clubs = await users.findClubs(userRow.user_id);
  return { ...tokens, user: users.toPublicUser(userRow, clubs) };
}

function invalidCodeError(result) {
  if (result.reason === 'TOO_MANY_ATTEMPTS') {
    return ApiError.badRequest('Too many incorrect attempts - request a new code', { code: 'CODE_ATTEMPTS_EXCEEDED' });
  }
  if (result.reason === 'INVALID') {
    return ApiError.badRequest('That code is incorrect', {
      code: 'INVALID_CODE',
      details: [{ field: 'code', message: `${result.attemptsRemaining} attempt(s) left` }],
    });
  }
  return ApiError.badRequest('That code has expired or was replaced - request a new one', { code: 'CODE_EXPIRED' });
}

/**
 * Student self-registration. Always resolves with the same payload.
 *
 * @param {{ fullName: string, email: string, password: string, departmentId: number, academicYear: number }} input
 */
async function register({ fullName, email: rawEmail, password, departmentId, academicYear }) {
  const email = normaliseEmail(rawEmail);
  const name = String(fullName).trim();

  if (!isAllowedDomain(email)) {
    const domains = config.auth.allowedEmailDomains.map((d) => `@${d}`).join(' or ');
    throw ApiError.validation('Use your college email address', [{ field: 'email', message: `Use your ${domains} address` }]);
  }

  const policyError = passwordPolicyError(password, { email, fullName: name });
  if (policyError) throw policyError;

  const { rows: [department] } = await db.query(
    'SELECT department_id FROM departments WHERE department_id = $1 AND is_active',
    [departmentId],
  );
  if (!department) {
    throw ApiError.validation('Choose a valid department', [{ field: 'departmentId', message: 'Unknown department' }]);
  }

  // Hash before branching, so every path costs the same bcrypt time.
  const passwordHash = await hashPassword(password);

  const mail = await db.withTransaction(async (client) => {
    const existing = await users.findByEmail(email, client, { forUpdate: true });

    if (existing && existing.is_verified) {
      return templates.alreadyRegistered({ fullName: existing.full_name });
    }

    if (existing) {
      // Unverified: nobody has proved they own this inbox yet, so the latest
      // registration wins. Whoever reads the code is the real owner.
      await client.query(
        `UPDATE users SET full_name = $2, password_hash = $3, department_id = $4, academic_year = $5
          WHERE user_id = $1`,
        [existing.user_id, name, passwordHash, departmentId, academicYear],
      );
    } else {
      const roleId = await users.getRoleId(ROLES.STUDENT, client);
      const { rowCount } = await client.query(
        `INSERT INTO users (full_name, email, password_hash, department_id, academic_year, role_id, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)
         ON CONFLICT (email) DO NOTHING`,
        [name, email, passwordHash, departmentId, academicYear, roleId],
      );
      // A concurrent registration for the same email won the race; it sends the code.
      if (rowCount === 0) return null;
    }

    const issued = await otp.issueOtp({ email, purpose: PURPOSE.EMAIL_VERIFICATION }, client);
    if (!issued.issued) return null;
    return templates.verificationCode({ fullName: name, code: issued.code, ttlMinutes: config.auth.otpTtlMinutes });
  });

  if (mail) mailer.sendMailInBackground({ to: email, ...mail });
  return codeSentResponse(email);
}

async function resendVerification({ email: rawEmail }) {
  const email = normaliseEmail(rawEmail);
  const user = await users.findByEmail(email);

  if (user && !user.is_verified && user.is_active) {
    const issued = await otp.issueOtp({ email, purpose: PURPOSE.EMAIL_VERIFICATION });
    if (issued.issued) {
      mailer.sendMailInBackground({
        to: email,
        ...templates.verificationCode({ fullName: user.full_name, code: issued.code, ttlMinutes: config.auth.otpTtlMinutes }),
      });
    }
  }
  return codeSentResponse(email);
}

/** Confirms the inbox and signs the new user straight in. */
async function verifyEmail({ email: rawEmail, code }, context) {
  const email = normaliseEmail(rawEmail);

  const result = await otp.verifyOtp({ email, purpose: PURPOSE.EMAIL_VERIFICATION, code });
  if (!result.ok) throw invalidCodeError(result);

  const userRow = await db.withTransaction(async (client) => {
    const user = await users.findByEmail(email, client, { forUpdate: true });
    if (!user || !user.is_active) return null;
    await client.query(
      'UPDATE users SET is_verified = TRUE, last_login_at = now() WHERE user_id = $1',
      [user.user_id],
    );
    const tokens = await issueSession(user, context, client);
    return { user: { ...user, is_verified: true }, tokens };
  });

  if (!userRow) throw invalidCodeError({ reason: 'NO_ACTIVE_CODE' });
  return withUserPayload(userRow.user, userRow.tokens);
}

const INVALID_CREDENTIALS_MESSAGE =
  'Incorrect email or password. After repeated failures, sign-in is paused for a few minutes.';

async function login({ email: rawEmail, password }, context) {
  const email = normaliseEmail(rawEmail);
  const user = await users.findByEmail(email);

  if (!user || !user.password_hash) {
    await verifyPassword(String(password), DUMMY_HASH);
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE, { code: 'INVALID_CREDENTIALS' });
  }

  const passwordOk = await verifyPassword(String(password), user.password_hash);
  const locked = user.locked_until && new Date(user.locked_until) > new Date();

  // While locked, even the right password is refused with the same message -
  // otherwise the lock would be an oracle for guessing.
  if (locked) {
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE, { code: 'INVALID_CREDENTIALS' });
  }

  if (!passwordOk) {
    await recordFailedLogin(user);
    throw ApiError.unauthorized(INVALID_CREDENTIALS_MESSAGE, { code: 'INVALID_CREDENTIALS' });
  }

  if (!user.is_active) {
    throw ApiError.forbidden('This account has been deactivated. Contact your department coordinator.', { code: 'ACCOUNT_DISABLED' });
  }
  if (!user.is_verified) {
    throw ApiError.forbidden('Verify your email address to continue', { code: 'EMAIL_NOT_VERIFIED', details: { email } });
  }

  const tokens = await db.withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now()
        WHERE user_id = $1`,
      [user.user_id],
    );
    // FR20 records user logins. It cannot fail the sign-in - see recordLogin.
    await audit.recordLogin({ userId: user.user_id, ip: context?.ip, userAgent: context?.userAgent }, client);
    return issueSession(user, context, client);
  });

  return withUserPayload(user, tokens);
}

async function recordFailedLogin(user) {
  const { maxFailedLogins, lockoutMinutes } = config.auth;
  const { rows: [row] } = await db.query(
    `UPDATE users
        SET failed_login_attempts = CASE WHEN failed_login_attempts + 1 >= $2 THEN 0 ELSE failed_login_attempts + 1 END,
            locked_until = CASE WHEN failed_login_attempts + 1 >= $2
                                THEN now() + make_interval(mins => $3) ELSE locked_until END
      WHERE user_id = $1
      RETURNING (locked_until IS NOT NULL AND locked_until > now()) AS locked_now`,
    [user.user_id, maxFailedLogins, lockoutMinutes],
  );

  if (row?.locked_now) {
    mailer.sendMailInBackground({
      to: user.email,
      ...templates.accountLocked({ fullName: user.full_name, minutes: lockoutMinutes }),
    });
  }
}

async function refresh({ refreshToken }, context) {
  const rotated = await sessions.rotateSession({ refreshToken, ...context });
  const user = await users.findById(rotated.userId);
  return withUserPayload(user, {
    accessToken: signAccessToken({ userId: rotated.userId, familyId: rotated.familyId }),
    accessTokenExpiresIn: Math.floor(config.jwt.accessTokenTtlMs / 1000),
    refreshToken: rotated.refreshToken,
    refreshTokenExpiresAt: rotated.expiresAt,
  });
}

async function logout({ refreshToken }) {
  await sessions.revokeToken(refreshToken);
}

async function logoutEverywhere(userId) {
  await sessions.revokeAllForUser(userId);
}

async function forgotPassword({ email: rawEmail }) {
  const email = normaliseEmail(rawEmail);
  const user = await users.findByEmail(email);

  if (user && user.is_active && user.password_hash) {
    const issued = await otp.issueOtp({ email, purpose: PURPOSE.PASSWORD_RESET });
    if (issued.issued) {
      mailer.sendMailInBackground({
        to: email,
        ...templates.passwordResetCode({ fullName: user.full_name, code: issued.code, ttlMinutes: config.auth.otpTtlMinutes }),
      });
    }
  }
  return codeSentResponse(email);
}

/**
 * Sets a new password from an emailed code, then ends every session. A
 * successful reset also proves inbox ownership, so it verifies the account.
 */
async function resetPassword({ email: rawEmail, code, newPassword }) {
  const email = normaliseEmail(rawEmail);

  // Policy first, without the user's name: a weak password should not burn
  // one of the code's limited attempts, and must not reveal the account.
  const policyError = passwordPolicyError(newPassword, { email });
  if (policyError) throw policyError;

  const result = await otp.verifyOtp({ email, purpose: PURPOSE.PASSWORD_RESET, code });
  if (!result.ok) throw invalidCodeError(result);

  const passwordHash = await hashPassword(newPassword);

  const user = await db.withTransaction(async (client) => {
    const row = await users.findByEmail(email, client, { forUpdate: true });
    if (!row || !row.is_active) return null;

    await client.query(
      `UPDATE users
          SET password_hash = $2, password_changed_at = now(), is_verified = TRUE,
              failed_login_attempts = 0, locked_until = NULL
        WHERE user_id = $1`,
      [row.user_id, passwordHash],
    );
    await sessions.revokeAllForUser(row.user_id, client);
    await otp.consumeAll({ email, purpose: PURPOSE.PASSWORD_RESET }, client);
    return row;
  });

  if (!user) throw invalidCodeError({ reason: 'NO_ACTIVE_CODE' });

  mailer.sendMailInBackground({ to: email, ...templates.passwordChanged({ fullName: user.full_name }) });
}

/**
 * Signed-in password change. Every other device is signed out; this one
 * gets a fresh session so the user is not bounced to the login page.
 */
async function changePassword(userId, { currentPassword, newPassword }, context) {
  const user = await users.findById(userId);
  if (!user || !user.password_hash) throw ApiError.unauthorized();

  if (!(await verifyPassword(String(currentPassword), user.password_hash))) {
    throw ApiError.validation('Your current password is incorrect', [
      { field: 'currentPassword', message: 'Incorrect password' },
    ]);
  }
  if (currentPassword === newPassword) {
    throw ApiError.validation('Choose a new password', [
      { field: 'newPassword', message: 'Must differ from your current password' },
    ]);
  }
  const problems = checkPasswordPolicy(newPassword, { email: user.email, fullName: user.full_name });
  if (problems.length > 0) {
    throw ApiError.validation('Choose a stronger password', problems.map((message) => ({ field: 'newPassword', message })));
  }

  const passwordHash = await hashPassword(newPassword);

  const tokens = await db.withTransaction(async (client) => {
    await client.query(
      'UPDATE users SET password_hash = $2, password_changed_at = now() WHERE user_id = $1',
      [userId, passwordHash],
    );
    await sessions.revokeAllForUser(userId, client);
    return issueSession(user, context, client);
  });

  mailer.sendMailInBackground({ to: user.email, ...templates.passwordChanged({ fullName: user.full_name }) });
  return withUserPayload(user, tokens);
}

async function getProfile(userId) {
  const user = await users.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return users.toPublicUser(user, await users.findClubs(userId));
}

module.exports = {
  register,
  resendVerification,
  verifyEmail,
  login,
  refresh,
  logout,
  logoutEverywhere,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
  normaliseEmail,
  isAllowedDomain,
  INVALID_CREDENTIALS_MESSAGE,
};
