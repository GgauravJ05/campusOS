'use strict';

const { normaliseMobile, isIndianMobile, isPersonName } = require('../../src/lib/validation');

// The public page keeps its own copy of these rules (frontend/public/about/validate.js)
// with the same test table, so a change to one needs the other.
const MOBILE_OK = [
  ['9876543210', '9876543210'],
  ['+91 98765 43210', '9876543210'],
  ['+919876543210', '9876543210'],
  ['91-98765-43210', '9876543210'],
  ['09876543210', '9876543210'],
  ['+91 (98765) 43210', '9876543210'],
  ['  6000000000  ', '6000000000'],
];
const MOBILE_BAD = [
  '', '   ', 'call me', '12345', '5876543210', '0987654321', '98765 4321', '98765432101', '+1 98765 43210',
  '98765x3210', '+91 5876543210', '9876543210+', '++919876543210', '+0 9876543210', null, undefined, 9876543210,
];

describe('normaliseMobile / isIndianMobile', () => {
  it.each(MOBILE_OK)('accepts %s as %s', (input, digits) => {
    expect(normaliseMobile(input)).toBe(digits);
    expect(isIndianMobile(input)).toBe(true);
  });

  it.each(MOBILE_BAD)('rejects %p', (input) => {
    expect(normaliseMobile(input)).toBeNull();
    expect(isIndianMobile(input)).toBe(false);
  });
});

describe('isPersonName', () => {
  it.each(['Asha Kulkarni', "Ravi D'Souza", 'Anne-Marie', 'Dr. Nishanti Naidu', 'श्रुति माने', 'Al', 'José Núñez'])(
    'accepts %s', (name) => expect(isPersonName(name)).toBe(true),
  );

  it.each(['', ' ', 'A', '..', '- -', "''", 'R2D2', 'Asha_K', 'Asha <b>', null, undefined, 42, 'x'.repeat(121)])(
    'rejects %p', (name) => expect(isPersonName(name)).toBe(false),
  );
});
