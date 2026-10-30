'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    // The config singleton is a one-line re-export of loadConfig, which has
    // its own suite; server.js is process glue (listen + wire) whose logic
    // lives in src/lifecycle.js and is fully covered there.
    '!src/config/index.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // The gate ratchets upward as each phase lands, never downward. A pull
  // request that drops coverage below these numbers fails CI.
  coverageThreshold: {
    global: { statements: 97, branches: 89, functions: 97, lines: 98 },
  },
  // Every database suite shares one PostgreSQL instance, and some of them
  // change global state (system_settings, venues, seat counters). Running
  // suites in parallel therefore makes them race each other rather than
  // test anything, so they run one at a time. The whole suite is seconds
  // either way; a flaky pipeline is not worth the saving. (CI passes
  // --runInBand for the same reason; this makes a plain `npm test` match it.)
  maxWorkers: 1,
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  verbose: false,
};
