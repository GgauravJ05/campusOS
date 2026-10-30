'use strict';

/**
 * Outbound email.
 *
 * With SMTP_HOST set, mail goes through that server. Without it (local
 * development, CI) nothing is sent: the message is written to the log so a
 * developer can read the verification code straight from the terminal.
 * Production refuses to boot without SMTP_HOST - see config/env.js.
 */

const nodemailer = require('nodemailer');
const config = require('../../config');
const logger = require('../../config/logger');

let transport = null;

function getTransport() {
  if (transport) return transport;

  transport = config.mail.host
    ? nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.password } : undefined,
    })
    : nodemailer.createTransport({ jsonTransport: true });

  return transport;
}

/**
 * @param {{ to: string, subject: string, text: string, html: string }} message
 */
async function sendMail({ to, subject, text, html }) {
  const info = await getTransport().sendMail({ from: config.mail.from, to, subject, text, html });

  if (!config.mail.host) {
    // Dev convenience only: this branch never runs in production.
    logger.info({ to, subject }, `[mail:dev] Not sent (no SMTP_HOST). Body:\n${text}`);
  }
  return info;
}

/**
 * Fire-and-forget send for the enumeration-safe flows (register, forgot
 * password). Awaiting would make "account exists" measurably slower than
 * "account does not exist"; a failure is logged, never surfaced.
 */
function sendMailInBackground(message) {
  sendMail(message).catch((err) => {
    logger.error({ err, to: message.to, subject: message.subject }, 'Failed to send email');
  });
}

/** Test hook: drop the cached transport. */
function resetTransport() {
  transport = null;
}

module.exports = { sendMail, sendMailInBackground, resetTransport };
