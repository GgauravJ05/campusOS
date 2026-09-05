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
    global: { statements: 95, branches: 88, functions: 95, lines: 95 },
  },
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  verbose: false,
};
