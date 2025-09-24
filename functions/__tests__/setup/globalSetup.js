// Global setup for E2E tests
module.exports = async () => {
  console.log('Setting up global test environment...');
  
  // Setup test environment variables
  process.env.NODE_ENV = 'test';
  process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'test';
  
  // Add any global setup needed for E2E tests
  // e.g., starting Azure Functions host for integration tests
};
