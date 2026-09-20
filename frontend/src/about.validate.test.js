import { beforeAll, describe, expect, it } from 'vitest'

// B25IT405 Lab 5. The public page ships its own copy of the validation rules
// (public/about/validate.js, a plain script that sets one global). The same
// table is in backend/tests/unit/validation.test.js; change both together.

let V
beforeAll(async () => {
  await import('../public/about/validate.js')
  V = globalThis.CampusValidate
})

const MOBILE_OK = [
  ['9876543210', '9876543210'],
  ['+91 98765 43210', '9876543210'],
  ['+919876543210', '9876543210'],
  ['91-98765-43210', '9876543210'],
  ['09876543210', '9876543210'],
  ['+91 (98765) 43210', '9876543210'],
  ['  6000000000  ', '6000000000'],
]
const MOBILE_BAD = [
  '', '   ', 'call me', '12345', '5876543210', '0987654321', '98765 4321', '98765432101', '+1 98765 43210',
  '98765x3210', '+91 5876543210', '9876543210+', '++919876543210', '+0 9876543210', null, undefined, 9876543210,
]

describe('public page validation', () => {
  it.each(MOBILE_OK)('accepts the mobile number %s', (input, digits) => {
    expect(V.normaliseMobile(input)).toBe(digits)
  })

  it.each(MOBILE_BAD)('rejects the mobile number %s', (input) => {
    expect(V.normaliseMobile(input)).toBeNull()
  })

  it.each(['Asha Kulkarni', "Ravi D'Souza", 'Anne-Marie', 'Dr. Nishanti Naidu', 'श्रुति माने', 'Al', 'José Núñez'])(
    'accepts the name %s', (name) => expect(V.isPersonName(name)).toBe(true),
  )

  it.each(['', ' ', 'A', '..', '- -', "''", 'R2D2', 'Asha_K', 'Asha <b>', null, undefined, 42, 'x'.repeat(121)])(
    'rejects the name %s', (name) => expect(V.isPersonName(name)).toBe(false),
  )

  it('checks email shape', () => {
    expect(V.isEmail('asha@mmcoe.edu.in')).toBe(true)
    for (const bad of ['', 'asha', 'asha@', '@mmcoe.edu.in', 'a b@mmcoe.edu.in', 'a@b', 'a@@b.co', null]) {
      expect(V.isEmail(bad)).toBe(false)
    }
  })

  it('reports each bad field of the contact form and nothing for a good one', () => {
    const good = { name: 'Asha Kulkarni', email: 'asha@mmcoe.edu.in', mobile: '98765 43210', message: 'Hello there, a real message.' }
    expect(V.validateContact(good)).toEqual({})
    expect(Object.keys(V.validateContact({ name: '', email: 'x', mobile: '1', message: 'short' })).sort())
      .toEqual(['email', 'message', 'mobile', 'name'])
    expect(V.validateContact({ ...good, message: 'x'.repeat(501) }).message).toMatch(/under 500/)
    expect(V.validateContact({ ...good, message: undefined }).message).toMatch(/at least 10/)
  })
})
