'use strict';

/**
 * Field validation written out by hand (B25IT405 Website Development and
 * Hosting, Lab 5: name, mobile number and email validation).
 *
 * The browser copy for the public page is frontend/public/about/validate.js and
 * follows the same rules; the server never trusts the browser, so this one is
 * the authoritative check. Keep the two test tables in step.
 */

/**
 * The 10 digits of an Indian mobile number, or null if `input` is not one.
 *
 * Accepted: "9876543210", "+91 98765 43210", "91-98765-43210", "09876543210",
 * "+91 (98765) 43210". A mobile number has ten digits and starts with 6, 7, 8
 * or 9; an optional country code (+91 or 91) or trunk prefix (0) may precede it.
 */
function normaliseMobile(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  // Only digits and the separators people actually type; a letter or any other symbol fails.
  if (!/^\+?[0-9 ()-]+$/.test(text)) return null;
  let digits = text.replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  // A "+" is only meaningful as the country-code marker.
  if (text.includes('+') && !text.replace(/[ ()-]/g, '').startsWith('+91')) return null;
  return /^[6-9][0-9]{9}$/.test(digits) ? digits : null;
}

const isIndianMobile = (input) => normaliseMobile(input) !== null;

/**
 * A person's name: letters (any script), combining marks, spaces, dots,
 * apostrophes and hyphens, with at least two actual letters, so "..", "- -"
 * and a lone initial are rejected.
 */
function isPersonName(input) {
  if (typeof input !== 'string') return false;
  const text = input.trim();
  if (text.length < 2 || text.length > 120) return false;
  if (!/^[\p{L}\p{M}.' -]+$/u.test(text)) return false;
  return (text.match(/\p{L}/gu) || []).length >= 2;
}

module.exports = { normaliseMobile, isIndianMobile, isPersonName };
