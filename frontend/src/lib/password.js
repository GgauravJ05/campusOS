/**
 * Client-side mirror of the backend password policy
 * (backend/src/services/auth/password.js). The server is the authority;
 * this only gives instant feedback while typing.
 */

export const MIN_LENGTH = 8
export const MAX_BYTES = 72

export function passwordChecks(password = '', { email = '', fullName = '' } = {}) {
  const lowered = password.toLowerCase()
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  const localPart = email.split('@')[0].toLowerCase()
  const nameParts = fullName.toLowerCase().split(/\s+/).filter((part) => part.length >= 4)

  return [
    { id: 'length', label: `At least ${MIN_LENGTH} characters`, ok: password.length >= MIN_LENGTH && new TextEncoder().encode(password).length <= MAX_BYTES },
    { id: 'variety', label: 'Three of: lowercase, uppercase, number, symbol', ok: classes >= 3 },
    {
      id: 'personal',
      label: 'Does not contain your name or email',
      ok: password.length > 0
        && !(localPart.length >= 4 && lowered.includes(localPart))
        && !nameParts.some((part) => lowered.includes(part)),
    },
  ]
}

/**
 * 0-4 score for the strength meter. Meeting the policy is 3; length and
 * full variety beyond it earn the last point.
 */
export function passwordScore(password = '', context) {
  if (!password) return 0
  const passed = passwordChecks(password, context).filter((c) => c.ok).length
  if (passed < 3) return Math.max(1, passed)
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  return password.length >= 14 || (password.length >= 12 && classes === 4) ? 4 : 3
}

export const SCORE_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
