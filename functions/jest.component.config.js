const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Component Tests',
  testMatch: [
    '<rootDir>/__tests__/component/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup/testSetup.js'
  ]
};
