// Global test setup for Azure Functions testing

// Mock Azure Functions context
global.mockAzureFunctionContext = (options = {}) => ({
  log: jest.fn(),
  log: {
    info: jest.fn(),
    warn: jest.fn(), 
    error: jest.fn(),
    verbose: jest.fn()
  },
  invocationId: options.invocationId || 'test-invocation-id',
  functionName: options.functionName || 'testFunction',
  extraInputs: new Map(),
  extraOutputs: new Map(),
  ...options
});

// Mock HTTP Request
global.mockHttpRequest = (body = {}, options = {}) => ({
  url: options.url || 'http://localhost:7071/api/test',
  method: options.method || 'POST',
  json: jest.fn().mockResolvedValue(body),
  query: new Map(Object.entries(options.query || {})),
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  headers: options.headers || {},
  ...options
});

// Global mocks
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

jest.mock('glob', () => ({
  sync: jest.fn()
}));

// Set up global environment
process.env.NODE_ENV = 'test';
process.env.AZURE_FUNCTIONS_ENVIRONMENT = 'test';
