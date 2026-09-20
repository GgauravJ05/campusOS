/*
 * Form validation, written by hand (B25IT405 Website Development and Hosting,
 * Lab 5: name, mobile number and email validation).
 *
 * The server has its own authoritative copy of the name and mobile rules
 * (backend/src/lib/validation.js) because a browser can always be bypassed.
 * This copy exists so people get an answer before they submit. Keep the two
 * test tables in step.
 *
 * Plain script: it publishes one global, CampusValidate, so the page needs no
 * build step.
 */
(function (root) {
  'use strict';

  /** The 10 digits of an Indian mobile number, or null. */
  function normaliseMobile(input) {
    if (typeof input !== 'string') return null;
    var text = input.trim();
    // Only digits and the separators people really type.
    if (!/^\+?[0-9 ()-]+$/.test(text)) return null;
    var digits = text.replace(/[^0-9]/g, '');
    if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
    else if (digits.length === 11 && digits.indexOf('0') === 0) digits = digits.slice(1);
    // A "+" only means "country code follows".
    if (text.indexOf('+') !== -1 && text.replace(/[ ()-]/g, '').indexOf('+91') !== 0) return null;
    return /^[6-9][0-9]{9}$/.test(digits) ? digits : null;
  }

  /** Letters (any script), spaces, dots, apostrophes, hyphens; at least two letters. */
  function isPersonName(input) {
    if (typeof input !== 'string') return false;
    var text = input.trim();
    if (text.length < 2 || text.length > 120) return false;
    if (!/^[\p{L}\p{M}.' -]+$/u.test(text)) return false;
    return (text.match(/\p{L}/gu) || []).length >= 2;
  }

  /** A pragmatic email check: something@something.tld, no spaces, one @. */
  function isEmail(input) {
    if (typeof input !== 'string') return false;
    var text = input.trim();
    return text.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
  }

  /**
   * Validates the contact form's fields and returns { field: message } for each
   * problem. An empty object means the form is valid.
   */
  function validateContact(values) {
    var errors = {};
    if (!isPersonName(values.name)) errors.name = 'Enter your name using letters (at least two).';
    if (!isEmail(values.email)) errors.email = 'Enter a valid email address, like name@mmcoe.edu.in.';
    if (normaliseMobile(values.mobile) === null) errors.mobile = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
    var message = typeof values.message === 'string' ? values.message.trim() : '';
    if (message.length < 10) errors.message = 'Tell us a little more (at least 10 characters).';
    else if (message.length > 500) errors.message = 'Keep it under 500 characters.';
    return errors;
  }

  root.CampusValidate = {
    normaliseMobile: normaliseMobile,
    isPersonName: isPersonName,
    isEmail: isEmail,
    validateContact: validateContact,
  };
})(typeof self !== 'undefined' ? self : globalThis);
