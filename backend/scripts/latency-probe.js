#!/usr/bin/env node
'use strict';

/**
 * A small response-time probe against a RUNNING API. It is not a load test:
 * one machine, one process, no ramp-up. It exists so the test report can quote
 * a measured number for the SRS response-time requirement instead of assuming.
 *
 *   node scripts/latency-probe.js [--base http://localhost:5050] [--requests 300] [--concurrency 25]
 *
 * Signs in once as the demo Principal, then times GETs against read endpoints.
 * Point it at a seeded database, not real data. Exit code 0, or 1 on error.
 */

const { parseArgs } = require('node:util');

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:5050' },
    requests: { type: 'string', default: '300' },
    concurrency: { type: 'string', default: '25' },
  },
});
const BASE = values.base;
const REQUESTS = Number.parseInt(values.requests, 10);
const CONCURRENCY = Number.parseInt(values.concurrency, 10);

const ENDPOINTS = [
  ['GET /api/health', '/api/health'],
  ['GET /api/venues', '/api/venues?pageSize=50'],
  ['GET /api/events', '/api/events?upcoming=true'],
  ['GET /api/dashboard', '/api/dashboard'],
  ['GET /api/reports/venue-utilisation', '/api/reports/venue-utilisation'],
];

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function signIn() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'gaurav.principal@mmcoe.edu.in', password: 'Campus@123' }),
  });
  if (!res.ok) throw new Error(`sign-in failed: HTTP ${res.status}`);
  return (await res.json()).data.accessToken;
}

/** Runs `total` requests, at most `concurrency` in flight; returns sorted latencies in ms and the failure count. */
async function measure(url, token, total, concurrency) {
  const times = [];
  let failures = 0;
  let next = 0;
  async function worker() {
    while (next < total) {
      next += 1;
      const started = performance.now();
      try {
        const res = await fetch(`${BASE}${url}`, { headers: { Authorization: `Bearer ${token}` } });
        await res.arrayBuffer();
        if (!res.ok) failures += 1;
      } catch {
        failures += 1;
      }
      times.push(performance.now() - started);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { times: times.sort((a, b) => a - b), failures };
}

(async () => {
  const token = await signIn();
  console.log(`${REQUESTS} requests per endpoint, ${CONCURRENCY} at a time, against ${BASE}\n`);
  console.log('endpoint'.padEnd(38), 'p50 ms'.padStart(8), 'p95 ms'.padStart(8), 'max ms'.padStart(8), 'failed'.padStart(7));
  for (const [label, url] of ENDPOINTS) {
    const { times, failures } = await measure(url, token, REQUESTS, CONCURRENCY);
    console.log(
      label.padEnd(38),
      percentile(times, 50).toFixed(1).padStart(8),
      percentile(times, 95).toFixed(1).padStart(8),
      times[times.length - 1].toFixed(1).padStart(8),
      String(failures).padStart(7),
    );
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
