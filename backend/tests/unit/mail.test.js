'use strict';

const templates = require('../../src/services/mail/templates');
const mailer = require('../../src/services/mail/mailer');
const logger = require('../../src/config/logger');

describe('email templates', () => {
  it('escapes HTML in user-controlled values', () => {
    expect(templates.escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;',
    );
  });

  it('never renders a name as markup', () => {
    const mail = templates.verificationCode({ fullName: '<img src=x onerror=alert(1)>', code: '012345', ttlMinutes: 10 });
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('&lt;img');
  });

  it.each([
    ['verificationCode', { fullName: 'Asha', code: '012345', ttlMinutes: 10 }, /012345/],
    ['passwordResetCode', { fullName: 'Asha', code: '987654', ttlMinutes: 10 }, /987654/],
    ['passwordChanged', { fullName: 'Asha' }, /forgot-password/],
    ['alreadyRegistered', { fullName: 'Asha' }, /\/login/],
    ['accountLocked', { fullName: 'Asha', minutes: 15 }, /15 minutes/],
  ])('%s produces a subject, text and html body', (name, input, textPattern) => {
    const mail = templates[name](input);
    expect(mail.subject.length).toBeGreaterThan(5);
    expect(mail.text).toMatch(textPattern);
    expect(mail.html).toMatch(/^<!doctype html>/);
  });
});

describe('mailer with SMTP configured', () => {
  it('sends through the SMTP server with credentials and does not log the body', async () => {
    await jest.isolateModulesAsync(async () => {
      process.env.SMTP_HOST = 'smtp.campus.test';
      process.env.SMTP_USER = 'mailer';
      process.env.SMTP_PASSWORD = 'secret';
      try {
        const nodemailer = require('nodemailer');
        const sendMail = jest.fn().mockResolvedValue({ messageId: 'm1' });
        const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail });
        const isolatedLogger = require('../../src/config/logger');
        const info = jest.spyOn(isolatedLogger, 'info').mockImplementation(() => {});
        const isolatedMailer = require('../../src/services/mail/mailer');

        await isolatedMailer.sendMail({ to: 'a@mmcoe.edu.in', subject: 'Hi', text: 'code', html: '<p/>' });

        expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
          host: 'smtp.campus.test', auth: { user: 'mailer', pass: 'secret' },
        }));
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@mmcoe.edu.in', subject: 'Hi' }));
        expect(info).not.toHaveBeenCalled();
      } finally {
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASSWORD;
      }
    });
  });
});

describe('mailer without SMTP', () => {
  beforeEach(() => mailer.resetTransport());

  it('does not send, and writes the message to the log for local development', async () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {});

    await mailer.sendMail({ to: 'a@mmcoe.edu.in', subject: 'Hi', text: 'code 123456', html: '<p>hi</p>' });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@mmcoe.edu.in', subject: 'Hi' }),
      expect.stringContaining('code 123456'),
    );
  });

  it('logs rather than throws when a background send fails', async () => {
    const nodemailer = require('nodemailer');
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) });
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {});

    expect(() => mailer.sendMailInBackground({ to: 'a@mmcoe.edu.in', subject: 'Hi', text: '', html: '' })).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@mmcoe.edu.in' }), 'Failed to send email');
  });
});
