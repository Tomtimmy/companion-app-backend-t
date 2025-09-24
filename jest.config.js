// jest.config.js
module.exports = {
  // Use 'jsdom' for component tests. Jest will infer 'node' for others.
  testEnvironment: 'jsdom',

  // This pattern finds all .test.js files across your test directories.
  testMatch: [
    '<rootDir>/functions/__tests__/unit/**/*.test.js',
    '<rootDir>/functions/__tests__/integration/**/*.test.js',
    '<rootDir>/functions/__tests__/component/**/*.test.js',
  ],

  // Global setup file for all tests.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Transform JS/JSX/TSX using Babel.
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },

  // Ignore node_modules by default, but specify exceptions.
  testPathIgnorePatterns: ['/node_modules/'],

  // Crucial for React Native: prevent transformation of node_modules,
  // unless they are explicitly listed (like react-native itself).
  transformIgnorePatterns: [
    'node_modules/(?!react-native|@react-native|react-clone-referenced-element|@react-navigation)',
  ],

  // --- NEW: Module Resolver ---
  // This helps Jest resolve modules located within the 'functions' directory.
  moduleNameMapper: {
    '^functions/(.*)$': '<rootDir>/functions/$1',
    // Add other module mappings if needed
  },

  // Good defaults.
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 10000,
};