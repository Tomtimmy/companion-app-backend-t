const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '<rootDir>/__tests__/integration/**/*.test.js'
  ],
  testTimeout: 30000, // Longer timeout for integration tests
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup/testSetup.js'
  ]
};
