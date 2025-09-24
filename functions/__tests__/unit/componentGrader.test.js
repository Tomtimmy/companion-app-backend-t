jest.mock('glob');
jest.mock('fs');

const { gradeComponents } = require('../../src/graders/componentGrader');
const fs = require('fs');
const glob = require('glob');

// We already mock 'fs' and 'glob' in our global test setup.

describe('Component Grader', () => {
  let mockContext;
  const mockComponentFiles = ['./components/Button.jsx', './components/List.jsx'];
  
  beforeEach(() => {
    mockContext = {
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      invocationId: 'test-invocation-id',
    };
    glob.sync.mockReturnValue(mockComponentFiles);
    jest.clearAllMocks();
  });

  // Our trusted helper function to trick the file system
  const setupMocks = (mockConfig) => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(filePath => {
      // If the call is for the config file, return the mock config
      if (filePath.includes('qa-grader.config.json')) {
        return JSON.stringify(mockConfig);
      }
      // Otherwise, return some default code for component files
      return 'export default () => <div/>';
    });
  };

  test('should successfully grade components when all rules pass', async () => {
    const mockConfig = {
      componentGrader: {
        run: true,
        minimumScore: 0.8,
        rules: { /* All rules enabled */
          checkAccessibilityLabel: true,
          checkTestID: true,
          checkInlineStyles: true,
          checkMissingKeys: true,
        },
      },
    };
    setupMocks(mockConfig);
    
    // Override readFileSync for just this test to return PERFECT code
    fs.readFileSync.mockImplementation(filePath => {
        if (filePath.includes('qa-grader.config.json')) return JSON.stringify(mockConfig);
        return `
            import { Pressable, Text, StyleSheet } from 'react-native';
            const Button = ({ onPress, title, accessibilityLabel, testID }) => (
                <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} style={styles.button}>
                    <Text>{title}</Text>
                </Pressable>
            );
            const styles = StyleSheet.create({ button: { padding: 10 } });
            export default Button;
        `;
    });
    
    const result = await gradeComponents('.', mockContext);

    expect(result.report.summary.issuesFound).toBe(0);
    expect(result.score).toBe(1);
    expect(result.success).toBe(true);
  });
  
  test('should detect missing accessibility labels if rule is enabled', async () => {
    const mockConfig = {
      componentGrader: {
        run: true,
        minimumScore: 0.8,
        rules: { checkAccessibilityLabel: true, checkTestID: false }
      }
    };
    setupMocks(mockConfig);
    
    fs.readFileSync.mockImplementation(filePath => {
      if (filePath.includes('qa-grader.config.json')) return JSON.stringify(mockConfig);
      // This component is missing an accessibilityLabel
      return `import { Pressable } from 'react-native'; export default () => <Pressable testID="id" />`;
    });

    const result = await gradeComponents('.', mockContext);
    
    expect(result.report.accessibility.length).toBeGreaterThan(0);
    expect(result.report.accessibility[0].issue).toBe('Missing accessibilityLabel');
    // It should NOT report a missing testID because that rule was false
    expect(result.report.testIds.length).toBe(0);
    expect(result.score).toBeLessThan(1);
  });
  
  test('should NOT detect issues if the corresponding rule is disabled', async () => {
    const mockConfig = {
      componentGrader: {
        run: true,
        minimumScore: 0.8,
        rules: { 
          checkAccessibilityLabel: false, // Rule is turned off!
          checkInlineStyles: false      // This one too!
        } 
      }
    };
    setupMocks(mockConfig);
    
    fs.readFileSync.mockImplementation(filePath => {
        if (filePath.includes('qa-grader.config.json')) return JSON.stringify(mockConfig);
        // This component has issues, but the rules are off
        return `import { Pressable } from 'react-native'; export default () => <Pressable style={{color: 'red'}} />`;
    });
    
    const result = await gradeComponents('.', mockContext);
    
    // Even though there are issues, the grader should not report them
    expect(result.report.summary.issuesFound).toBe(0);
    expect(result.score).toBe(1);
  });
});