'use strict';

/**
 * HTTP adapter for authentication. The refresh token only ever travels in
 * an httpOnly cookie scoped to /api/auth - page JavaScript can never read
 * it, so an XSS bug cannot exfiltrate a long-lived session. The short-lived
 * access token is returned in the body and kept in memory by the client.
 */

const config = require('../config');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const auth = require('../services/auth/auth.service');

const COOKIE_PATH = '/api/auth';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: COOKIE_PATH,
  };
}

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(config.auth.refreshCookieName, token, { ...refreshCookieOptions(), expires: new Date(expiresAt) });
}

function clearRefreshCookie(res) {
  res.clearCookie(config.auth.refreshCookieName, refreshCookieOptions());
}

function requestContext(req) {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

/** Moves the refresh token into the cookie and returns the rest. */
function sendSession(res, status, { refreshToken, refreshTokenExpiresAt, ...session }) {
  setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
  res.set('Cache-Control', 'no-store');
  return sendSuccess(res, status, session);
}

const CODE_SENT = 'If that email can receive a code, we have sent one. Check your inbox and spam folder.';

const register = asyncHandler(async (req, res) => {
  const data = await auth.register(req.body);
  sendSuccess(res, 202, { ...data, message: CODE_SENT });
});

const resendVerification = asyncHandler(async (req, res) => {
  const data = await auth.resendVerification(req.body);
  sendSuccess(res, 202, { ...data, message: CODE_SENT });
});

const verifyEmail = asyncHandler(async (req, res) => {
  sendSession(res, 200, await auth.verifyEmail(req.body, requestContext(req)));
});

const login = asyncHandler(async (req, res) => {
  sendSession(res, 200, await auth.login(req.body, requestContext(req)));
});

const refresh = asyncHandler(async (req, res) => {
  try {
    const refreshToken = req.cookies?.[config.auth.refreshCookieName];
    sendSession(res, 200, await auth.refresh({ refreshToken }, requestContext(req)));
  } catch (err) {
    // A stale-but-legitimate race keeps the cookie the browser already holds.
    if (err.code !== 'SESSION_STALE') clearRefreshCookie(res);
    throw err;
  }
});

const logout = asyncHandler(async (req, res) => {
  await auth.logout({ refreshToken: req.cookies?.[config.auth.refreshCookieName] });
  clearRefreshCookie(res);
  res.status(204).end();
});

const logoutEverywhere = asyncHandler(async (req, res) => {
  await auth.logoutEverywhere(req.user.id);
  clearRefreshCookie(res);
  res.status(204).end();
});

const forgotPassword = asyncHandler(async (req, res) => {
  const data = await auth.forgotPassword(req.body);
  sendSuccess(res, 202, { ...data, message: CODE_SENT });
});

const resetPassword = asyncHandler(async (req, res) => {
  await auth.resetPassword(req.body);
  clearRefreshCookie(res);
  sendSuccess(res, 200, { message: 'Password updated. Sign in with your new password.' });
});

const changePassword = asyncHandler(async (req, res) => {
  sendSession(res, 200, await auth.changePassword(req.user.id, req.body, requestContext(req)));
});

const me = asyncHandler(async (req, res) => {
  sendSuccess(res, 200, await auth.getProfile(req.user.id));
});

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
  me,
  COOKIE_PATH,
};
