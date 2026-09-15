'use strict';

/**
 * Email bodies. Each returns { subject, text, html }.
 *
 * Every value interpolated into HTML goes through `escapeHtml` - a user's
 * full name is user input and must not become markup in someone's inbox.
 */

const config = require('../../config');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({ heading, bodyHtml }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:18px;font-weight:700;color:#4f46e5;padding-bottom:24px">CampusOS</td></tr>
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">${heading}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
        <tr><td style="font-size:12px;color:#6b7280;padding-top:32px">
          MMCOE Smart Campus Management Platform. If you did not expect this email you can ignore it.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function codeBlock(code) {
  return `<div style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;background:#eef2ff;border-radius:8px;padding:16px;margin:20px 0;font-family:ui-monospace,Menlo,monospace">${escapeHtml(code)}</div>`;
}

function verificationCode({ fullName, code, ttlMinutes }) {
  const name = escapeHtml(fullName);
  return {
    subject: `${code} is your CampusOS verification code`,
    text: `Hi ${fullName},\n\nYour CampusOS verification code is ${code}.\nIt expires in ${ttlMinutes} minutes.\n\nNever share this code with anyone.`,
    html: layout({
      heading: 'Verify your email',
      bodyHtml: `<p>Hi ${name},</p><p>Enter this code to finish creating your account:</p>${codeBlock(code)}<p>It expires in ${ttlMinutes} minutes. Never share this code with anyone - CampusOS staff will never ask for it.</p>`,
    }),
  };
}

function passwordResetCode({ fullName, code, ttlMinutes }) {
  const name = escapeHtml(fullName);
  return {
    subject: `${code} is your CampusOS password reset code`,
    text: `Hi ${fullName},\n\nSomeone asked to reset your CampusOS password. Your code is ${code}.\nIt expires in ${ttlMinutes} minutes.\n\nIf this was not you, ignore this email - your password stays the same.`,
    html: layout({
      heading: 'Reset your password',
      bodyHtml: `<p>Hi ${name},</p><p>Someone asked to reset your CampusOS password. Use this code:</p>${codeBlock(code)}<p>It expires in ${ttlMinutes} minutes.</p><p><strong>If this was not you</strong>, ignore this email. Your password has not changed.</p>`,
    }),
  };
}

function passwordChanged({ fullName }) {
  const name = escapeHtml(fullName);
  const resetUrl = `${config.appUrl}/forgot-password`;
  return {
    subject: 'Your CampusOS password was changed',
    text: `Hi ${fullName},\n\nYour CampusOS password was just changed and every device was signed out.\n\nIf you did not do this, reset your password now: ${resetUrl}`,
    html: layout({
      heading: 'Your password was changed',
      bodyHtml: `<p>Hi ${name},</p><p>Your CampusOS password was just changed, and every signed-in device was signed out.</p><p>If you did not do this, <a href="${escapeHtml(resetUrl)}" style="color:#4f46e5">reset your password now</a> and tell your department coordinator.</p>`,
    }),
  };
}

function alreadyRegistered({ fullName }) {
  const name = escapeHtml(fullName);
  const loginUrl = `${config.appUrl}/login`;
  const resetUrl = `${config.appUrl}/forgot-password`;
  return {
    subject: 'You already have a CampusOS account',
    text: `Hi ${fullName},\n\nSomeone tried to create a CampusOS account with this email, but you already have one.\nSign in: ${loginUrl}\nForgot your password? ${resetUrl}\n\nIf this was not you, no action is needed.`,
    html: layout({
      heading: 'You already have an account',
      bodyHtml: `<p>Hi ${name},</p><p>Someone tried to create a CampusOS account with this email address, but one already exists.</p><p><a href="${escapeHtml(loginUrl)}" style="color:#4f46e5">Sign in</a> or <a href="${escapeHtml(resetUrl)}" style="color:#4f46e5">reset your password</a>.</p><p>If this was not you, no action is needed.</p>`,
    }),
  };
}

function accountLocked({ fullName, minutes }) {
  const name = escapeHtml(fullName);
  const resetUrl = `${config.appUrl}/forgot-password`;
  return {
    subject: 'CampusOS sign-in temporarily locked',
    text: `Hi ${fullName},\n\nThere were too many failed sign-in attempts on your account, so sign-in is locked for ${minutes} minutes.\nIf this was not you, reset your password: ${resetUrl}`,
    html: layout({
      heading: 'Sign-in temporarily locked',
      bodyHtml: `<p>Hi ${name},</p><p>There were too many failed sign-in attempts on your account, so sign-in is locked for ${minutes} minutes.</p><p>If this was not you, <a href="${escapeHtml(resetUrl)}" style="color:#4f46e5">reset your password</a>.</p>`,
    }),
  };
}

module.exports = {
  escapeHtml,
  verificationCode,
  passwordResetCode,
  passwordChanged,
  alreadyRegistered,
  accountLocked,
};
