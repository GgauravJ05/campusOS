import { chromium } from 'playwright-core'

export const BASE = process.env.WEB || 'http://localhost:5275'
export const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export const PASSWORD = 'Campus@123'

// A 1280x720 layout captured at 1.5x is a crisp 1920x1080 frame, with the app laid out as on a laptop.
export const VIEW = { width: 1280, height: 720 }

export async function launch() {
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] })
}

/**
 * A browser window signed in as one demo account. It signs in through the same
 * API call the login form makes; the refresh cookie it receives is what the app
 * picks up when the page loads. `dark` starts the app in dark mode.
 */
export async function signedIn(browser, email, { dark = false } = {}) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1.5, colorScheme: dark ? 'dark' : 'light' })
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  const status = await page.evaluate(async ({ email, password }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    })
    return res.status
  }, { email, password: PASSWORD })
  if (status !== 200) throw new Error(`sign-in as ${email} failed: ${status}`)
  return page
}

/** Today in Pune, plus n days, as YYYY-MM-DD. */
export function day(n) {
  const base = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()) + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + n)
  return base.toISOString().slice(0, 10)
}
