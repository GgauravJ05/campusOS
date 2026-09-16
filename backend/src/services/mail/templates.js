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

const BOOKING_OUTCOMES = Object.freeze({
  APPROVED: { subject: 'approved', heading: 'Your venue request was approved', lead: 'Good news - your venue request was approved and the slot is now booked for you.' },
  REJECTED: { subject: 'not approved', heading: 'Your venue request was not approved', lead: 'Your venue request was not approved.', noteLabel: 'Reason' },
  CHANGES_REQUESTED: { subject: 'needs changes', heading: 'Changes requested on your venue request', lead: 'The approver asked for changes before they can decide. Edit the request and send it again.', noteLabel: 'What to change' },
  CANCELLED: { subject: 'cancelled', heading: 'Your venue booking was cancelled', lead: 'Faculty cancelled your venue booking, and the slot has been released.' },
});

/**
 * Tells a requester what happened to their venue request (FR13).
 * @param {{ fullName, outcome: keyof BOOKING_OUTCOMES, bookingId, title, venueName, date, startTime, endTime, note?, deciderName? }} input
 */
function bookingOutcome({ fullName, outcome, bookingId, title, venueName, date, startTime, endTime, note = null, deciderName = null }) {
  const copy = BOOKING_OUTCOMES[outcome];
  const url = `${config.appUrl}/bookings?focus=${bookingId}`;
  const when = `${date}, ${startTime}-${endTime}`;
  const showNote = Boolean(note && copy.noteLabel);
  const by = deciderName ? ` (by ${deciderName})` : '';
  return {
    subject: `"${title}" ${copy.subject}`,
    text: `Hi ${fullName},\n\n${copy.lead}${by}\n\n${title}\n${venueName}\n${when}\n${showNote ? `\n${copy.noteLabel}: ${note}\n` : ''}\nOpen it: ${url}`,
    html: layout({
      heading: copy.heading,
      bodyHtml: `<p>Hi ${escapeHtml(fullName)},</p><p>${copy.lead}${escapeHtml(by)}</p>`
        + `<div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0"><strong>${escapeHtml(title)}</strong><br>${escapeHtml(venueName)}<br>${escapeHtml(when)}</div>`
        + (showNote ? `<p><strong>${copy.noteLabel}:</strong> ${escapeHtml(note)}</p>` : '')
        + `<p><a href="${escapeHtml(url)}" style="color:#4f46e5">Open the request</a></p>`,
    }),
  };
}

const REGISTRATION_OUTCOMES = Object.freeze({
  RESERVED: { subject: 'seat confirmed', heading: 'Your seat is confirmed', lead: 'You are registered. Your seat is confirmed.' },
  WAITLISTED: { subject: 'waitlisted', heading: "You're on the waitlist", lead: 'This event is full, so you are on the waitlist. We will move you up automatically if a seat frees up.' },
  PROMOTED: { subject: 'a seat opened up', heading: 'A seat opened up for you', lead: 'Someone cancelled, so you have been moved off the waitlist. Your seat is confirmed.' },
});

/**
 * Confirms an RSVP, a waitlist place, or a promotion off the waitlist
 * (FR15, FR16).
 * @param {{ fullName, outcome: keyof REGISTRATION_OUTCOMES, title, venueName, date, startTime, endTime, seats }} input
 */
function registrationOutcome({ fullName, outcome, title, venueName, date, startTime, endTime, seats = 1 }) {
  const copy = REGISTRATION_OUTCOMES[outcome];
  const url = `${config.appUrl}/events`;
  const when = `${date}, ${startTime}-${endTime}`;
  const seatLine = seats > 1 ? `${seats} seats` : '1 seat';
  return {
    subject: `"${title}" - ${copy.subject}`,
    text: `Hi ${fullName},\n\n${copy.lead}\n\n${title}\n${venueName}\n${when}\n${seatLine}\n\nSee your events: ${url}`,
    html: layout({
      heading: copy.heading,
      bodyHtml: `<p>Hi ${escapeHtml(fullName)},</p><p>${copy.lead}</p>`
        + `<div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0"><strong>${escapeHtml(title)}</strong><br>${escapeHtml(venueName)}<br>${escapeHtml(when)}<br>${escapeHtml(seatLine)}</div>`
        + `<p><a href="${escapeHtml(url)}" style="color:#4f46e5">See your events</a></p>`,
    }),
  };
}

function addedToClub({ fullName, clubName, position, addedBy }) {
  const url = `${config.appUrl}/clubs`;
  const role = position.toLowerCase().replace(/_/g, ' ');
  return {
    subject: `You were added to ${clubName}`,
    text: `Hi ${fullName},\n\n${addedBy} added you to ${clubName} as ${role}.\n\nSee your clubs: ${url}`,
    html: layout({
      heading: `Welcome to ${escapeHtml(clubName)}`,
      bodyHtml: `<p>Hi ${escapeHtml(fullName)},</p><p>${escapeHtml(addedBy)} added you to <strong>${escapeHtml(clubName)}</strong> as ${escapeHtml(role)}.</p><p><a href="${escapeHtml(url)}" style="color:#4f46e5">See your clubs</a></p>`,
    }),
  };
}

module.exports = {
  bookingOutcome,
  registrationOutcome,
  addedToClub,
  escapeHtml,
  verificationCode,
  passwordResetCode,
  passwordChanged,
  alreadyRegistered,
  accountLocked,
};
