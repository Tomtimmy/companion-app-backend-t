module.exports = {
  // Define the project root as the directory where this file lives.
  rootDir: '.',
  testEnvironment: 'node',
  
  // --- THIS IS THE FIX ---
  // This pattern is now very specific. It tells Jest to ONLY run files
  // that are inside `functions/__tests__/unit/`. This automatically
  // ignores the `setup` directory.
  testMatch: [
    '<rootDir>/functions/__tests__/unit/**/*.test.js'
  ],

  // Tell Jest to run your one, correct setup file before the tests begin.
  setupFilesAfterEnv: ['<rootDir>/functions/__tests__/setup/testSetup.js'],
  
  // Standard settings for a clean run.
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  // Still good practice to explicitly ignore node_modules.
  testPathIgnorePatterns: ['/node_modules/'], 
};

module.exports = {
  testEnvironment: "node",
  testMatch: [
    "**/functions/__tests__/unit/**/*.test.js",
    "**/functions/__tests__/integration/**/*.test.js",
    "**/functions/__tests__/component/**/*.test.js"
  ],
  testPathIgnorePatterns: ["/node_modules/"]
};

// jest.config.js
module.exports = {
  // Default test environment for React/component tests
  testEnvironment: "jsdom",

  // Global setup for Testing Library
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Transform modern JS + JSX/TSX
  transform: {
    "^.+\\.[tj]sx?$": "babel-jest",
  },

  // Organize test types
  testMatch: [
    "<rootDir>/functions/__tests__/unit/**/*.test.js",
    "<rootDir>/functions/__tests__/integration/**/*.test.js",
    "<rootDir>/functions/__tests__/component/**/*.test.js"
  ],

  // Ignore node_modules
  testPathIgnorePatterns: ["/node_modules/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Good defaults
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  testTimeout: 10000,
};

module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|react-clone-referenced-element)/)"
  ],
};

module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|react-clone-referenced-element|react-navigation)/)"
  ],
};
