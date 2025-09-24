jest.mock('fs');

// Mock child_process BEFORE requiring the grader
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

const { exec } = require('child_process');
const { gradeCodeQuality } = require('../../src/graders/codeQualityGrader');
const fs = require('fs'); // We need fs to control its mocked version

// We already mock 'fs' in our global test setup, so we just need to use it.

describe('Code Quality Grader', () => {
  let mockContext;
  
  beforeEach(() => {
    mockContext = {
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      invocationId: 'test-invocation-id',
    };
    exec.mockReset();
    jest.clearAllMocks();
  });

  // Re-usable helper to setup the mocks for each test
  const setupMocks = (mockConfig) => {
    // --- THIS IS THE FIX ---
    // STEP 1: Tell the grader that the file EXISTS (answer the knock)
    fs.existsSync.mockReturnValue(true);
    // STEP 2: Tell the grader WHAT the file contains (give it the book)
    fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
  };

  test('should pass when all checks succeed with weights', async () => {
    const mockConfig = {
      codeQuality: {
        run: true,
        minimumScore: 0.8,
        checks: { runLint: true, runTests: true, runTypeCheck: true },
        weights: { linting: 30, tests: 50, typeCheck: 20 }
      }
    };
    setupMocks(mockConfig); // Use our new helper

    exec.mockImplementation((command, options, callback) => {
        callback(null, { stdout: 'Success', stderr: '' });
    });

    const result = await gradeCodeQuality('.', mockContext);

    expect(result.score).toBe(1);
    expect(result.success).toBe(true);
  });
  
  test('should fail when linting fails', async () => {
    const mockConfig = {
      codeQuality: {
        run: true,
        minimumScore: 0.8,
        checks: { runLint: true, runTests: false, runTypeCheck: false },
        weights: { linting: 100, tests: 0, typeCheck: 0 }
      }
    };
    setupMocks(mockConfig); // Use our new helper

    exec.mockImplementation((command, options, callback) => {
      if (command.includes('lint')) {
        callback(new Error('Linting failed'));
      }
    });

    const result = await gradeCodeQuality('.', mockContext);
    
    expect(result.report.linting.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  test('should calculate overall score correctly when one check fails with weights', async () => {
    const mockConfig = {
      codeQuality: {
        run: true,
        minimumScore: 0.8,
        checks: { runLint: true, runTests: true, runTypeCheck: true },
        weights: { linting: 30, tests: 50, typeCheck: 20 }
      }
    };
    setupMocks(mockConfig); // Use our new helper
  
    exec.mockImplementation((command, options, callback) => {
      if (command.includes('lint')) {
        callback(new Error('Linting failed'));
      } else {
        callback(null, { stdout: 'Success', stderr: '' });
      }
    });
    
    const result = await gradeCodeQuality('.', mockContext);
    
    expect(result.score).toBe(0.7); // 70 / 100
    expect(result.success).toBe(false);
  });

  test('should skip disabled checks and return perfect score', async () => {
    const mockConfig = {
      codeQuality: {
        run: true,
        checks: { runLint: false, runTests: false, runTypeCheck: false },
        weights: { linting: 30, tests: 50, typeCheck: 20 }
      }
    };
    setupMocks(mockConfig); // Use our new helper

    const result = await gradeCodeQuality('.', mockContext);
    
    expect(exec).not.toHaveBeenCalled();
    expect(result.score).toBe(1);
  });
  
  test('should skip all checks if the main "run" is false', async () => {
    const mockConfig = {
      codeQuality: {
        run: false 
      }
    };
    setupMocks(mockConfig); // Use our new helper
      
    const result = await gradeCodeQuality('.', mockContext);

    expect(exec).not.toHaveBeenCalled();
    expect(result.score).toBe(1);
    expect(result.report.summary).toBe('Skipped');
  });
});