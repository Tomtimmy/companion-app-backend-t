const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'E2E Tests',
  testMatch: [
    '<rootDir>/__tests__/e2e/**/*.test.js'
  ],
  testTimeout: 60000, // Much longer timeout for E2E tests
  globalSetup: '<rootDir>/__tests__/setup/globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/setup/globalTeardown.js'
};
