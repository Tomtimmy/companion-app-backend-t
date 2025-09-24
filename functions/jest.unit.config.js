const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Unit Tests',
  testMatch: [
    '<rootDir>/__tests__/unit/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/setup/'],
};