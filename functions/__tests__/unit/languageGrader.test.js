const { gradeLanguageImplementation, resolveKey, extractAllKeys } = require('../../src/graders/languageGrader');
const fs = require('fs');
const path = require('path');

// Mock fs and glob
jest.mock('fs');
jest.mock('glob');

describe('Language Grader', () => {
  let mockContext;

  beforeEach(() => {
    // context.log as function, not object!
    mockContext = {
      log: jest.fn(),
      invocationId: 'test-invocation-id',
      functionName: 'testFunction'
    };
    jest.clearAllMocks();
});

  describe('resolveKey', () => {
    const testTranslations = {
      simple: 'value',
      nested: {
        key: 'nested value'
      },
      array: [
        { title: 'First item' },
        { title: 'Second item' }
      ]
    };

    test('should resolve simple key', () => {
      expect(resolveKey(testTranslations, 'simple')).toBe('value');
    });

    test('should resolve nested key', () => {
      expect(resolveKey(testTranslations, 'nested.key')).toBe('nested value');
    });

    test('should resolve array key with dot notation', () => {
      expect(resolveKey(testTranslations, 'array.0.title')).toBe('First item');
    });

    test('should return undefined for non-existent key', () => {
      expect(resolveKey(testTranslations, 'nonexistent')).toBeUndefined();
    });
  });

  describe('extractAllKeys', () => {
    test('should extract all keys from nested object', () => {
      const obj = {
        level1: {
          level2: 'value',
          array: ['item1', 'item2']
        }
      };

      const keys = extractAllKeys(obj);
      expect(keys).toContain('level1.level2');
      expect(keys).toContain('level1.array.0');
      expect(keys).toContain('level1.array.1');
    });

    test('should handle empty object', () => {
      const keys = extractAllKeys({});
      expect(keys).toEqual([]);
    });

    test('should handle complex nested structures', () => {
      const obj = {
        screen: {
          title: 'Screen Title',
          buttons: [
            { label: 'Save', action: 'save' },
            { label: 'Cancel', action: 'cancel' }
          ],
          form: {
            fields: {
              name: 'Name field',
              email: 'Email field'
            }
          }
        }
      };

      const keys = extractAllKeys(obj);
      expect(keys).toContain('screen.title');
      expect(keys).toContain('screen.buttons.0.label');
      expect(keys).toContain('screen.buttons.1.action');
      expect(keys).toContain('screen.form.fields.name');
      expect(keys).toContain('screen.form.fields.email');
    });
  });

  describe('gradeLanguageImplementation', () => {
    beforeEach(() => {
      // Mock file system calls
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('en.json')) {
          return JSON.stringify({
            screen: {
              title: 'Screen Title',
              button: 'Click Me'
            }
          });
        }
        if (filePath.includes('component.js')) {
          return `
            export const Component = () => (
              <Text>{i18n.t('screen.title')}</Text>
              <Button title={i18n.t('screen.button')} />
              <Text>Hardcoded Text</Text>
            );
          `;
        }
        return '';
      });

      // Mock glob
      require('glob').sync.mockReturnValue(['./src/component.js']);
    });

    test('should grade implementation successfully', async () => {
      const config = {
        translationFile: './en.json',
        sourcePattern: './src/**/*.js',
        minimumScore: 0.5
      };

      const result = await gradeLanguageImplementation(config, mockContext);

      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.report).toHaveProperty('summary');
      expect(result.report.summary.filesScanned).toBe(1);
    });

    test('should detect missing translation keys', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('en.json')) {
          return JSON.stringify({
            screen: {
              title: 'Screen Title'
              // missing 'button' key
            }
          });
        }
        if (filePath.includes('component.js')) {
          return `<Text>{i18n.t('screen.missing')}</Text>`;
        }
        return '';
      });

      const config = { translationFile: './en.json' };
      const result = await gradeLanguageImplementation(config, mockContext);

      expect(result.report.missingKeys.length).toBeGreaterThan(0);
      expect(result.report.missingKeys[0]).toMatchObject({
        file: expect.stringContaining('component.js'),
        key: 'screen.missing'
      });
    });

    test('should detect hardcoded strings', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('component.js')) {
          return `<Text>This is hardcoded text</Text>`;
        }
        return filePath.includes('en.json') ? '{}' : '';
      });

      const config = { translationFile: './en.json' };
      const result = await gradeLanguageImplementation(config, mockContext);

      expect(result.report.hardcodedStrings.length).toBeGreaterThan(0);
      expect(result.report.hardcodedStrings[0]).toMatchObject({
        file: expect.stringContaining('component.js'),
        text: 'This is hardcoded text'
      });
    });

    test('should handle translation file not found', async () => {
      fs.existsSync.mockReturnValue(false);

      const config = { translationFile: './missing.json' };
      const result = await gradeLanguageImplementation(config, mockContext);

      expect(result.success).toBe(false);
      expect(result.score).toBe(0);
      expect(result.report.error).toContain('Translation file not found');
    });

    test('should handle malformed JSON in translation file', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('en.json')) {
          return '{ invalid json }';
        }
        return '';
      });

      const config = { translationFile: './en.json' };
      const result = await gradeLanguageImplementation(config, mockContext);

      expect(result.success).toBe(false);
      expect(result.score).toBe(0);
      expect(result.report.error).toContain('Failed to load translation file');
    });

    test('should detect malformed keys (bracket notation)', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('en.json')) {
          return JSON.stringify({ test: 'value' });
        }
        if (filePath.includes('component.js')) {
          return `<Text>{i18n.t('array[0].title')}</Text>`;
        }
        return '';
      });

      const config = { translationFile: './en.json' };
      const result = await gradeLanguageImplementation(config, mockContext);

      expect(result.report.malformedKeys.length).toBeGreaterThan(0);
      expect(result.report.malformedKeys[0]).toMatchObject({
        file: expect.stringContaining('component.js'),
        key: 'array[0].title',
        issue: 'Use dot notation instead of bracket notation'
      });
    });

    test('should calculate score correctly', async () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('en.json')) {
          return JSON.stringify({
            screen: { title: 'Title', button: 'Button' }
          });
        }
        if (filePath.includes('component.js')) {
          return `
            <Text>{i18n.t('screen.title')}</Text>
            <Button title={i18n.t('screen.button')} />
          `;
        }
        return '';
      });

      const config = { 
        translationFile: './en.json',
        minimumScore: 0.8 
      };
      const result = await gradeLanguageImplementation(config, mockContext);

      expect(result.score).toBeGreaterThan(0.8);
      expect(result.success).toBe(true);
      expect(result.report.summary.score).toBe(result.score);
    });
  });
});
