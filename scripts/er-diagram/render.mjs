// Renders a diagram-design HTML file to PNG (2x, diagram only) and a standalone SVG.
//   node render.mjs <abs path to .html> <out.png> [out.svg]
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
const [src, png, svgOut] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
await page.goto('file://' + src)
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(600)
const fam = await page.evaluate(() => ['Geist','Geist Mono','Instrument Serif'].map((f) => `${f}:${document.fonts.check(`12px "${f}"`)}`).join(' '))
console.log('fonts', fam)
await page.locator('svg').screenshot({ path: png, omitBackground: true })
if (svgOut) {
  let svg = await page.$eval('svg', (el) => el.outerHTML)
  svg = svg.replace(/(fill|stroke)="rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*\.?\d+)\s*\)"/g, (m, a, r, g, b, al) => `${a}="#${[r,g,b].map((n) => Number(n).toString(16).padStart(2,'0')).join('')}" ${a}-opacity="${al}"`).replace(/(fill|stroke)="transparent"/g, '$1="none"')
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  const fonts = `<defs><style>@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400;500;600&amp;display=swap');</style>`
  svg = svg.replace(/<defs\s*\/?>(<\/defs>)?/, fonts + '</defs>')
  writeFileSync(svgOut, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg)
}
await browser.close()
