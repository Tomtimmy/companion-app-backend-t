const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const { promisify } = require('util');

const globAsync = promisify(glob);

/**
 * File Scanner Utility for Companion Grader Functions
 * Provides comprehensive file scanning capabilities for React Native code analysis
 */
class FileScanner {
  constructor(config = {}) {
    this.config = {
      // Default patterns for different file types
      sourcePatterns: config.sourcePatterns || [
        '**/*.{js,jsx,ts,tsx}',
        '!node_modules/**',
        '!dist/**',
        '!build/**',
        '!coverage/**'
      ],
      componentPatterns: config.componentPatterns || [
        'components/**/*.{js,jsx,ts,tsx}',
        'src/components/**/*.{js,jsx,ts,tsx}'
      ],
      translationPatterns: config.translationPatterns || [
        '**/i18n.js',
        '**/locales/**/*.json',
        '**/translations/**/*.json',
        'store/en.json'
      ],
      testPatterns: config.testPatterns || [
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/__tests__/**/*.{js,jsx,ts,tsx}'
      ],
      // Performance settings
      maxFileSize: config.maxFileSize || 5 * 1024 * 1024, // 5MB
      timeout: config.timeout || 30000, // 30 seconds
      ...config
    };
  }

  /**
   * Scan files based on patterns with async processing
   * @param {string|Array} patterns - Glob patterns to match files
   * @param {Object} options - Additional scanning options
   * @returns {Promise<Array>} Array of file paths and metadata
   */
  async scanFiles(patterns, options = {}) {
    const startTime = Date.now();
    const scanOptions = {
      cwd: options.cwd || process.cwd(),
      absolute: true,
      nodir: true,
      ignore: options.ignore || ['node_modules/**', '.git/**'],
      ...options
    };

    try {
      // Normalize patterns to array
      const normalizedPatterns = Array.isArray(patterns) ? patterns : [patterns];
      
      // Scan all patterns concurrently
      const allMatches = await Promise.all(
        normalizedPatterns.map(pattern => globAsync(pattern, scanOptions))
      );

      // Flatten and deduplicate results
      const uniqueFiles = [...new Set(allMatches.flat())];

      // Get file metadata in parallel with concurrency limit
      const fileResults = await this.processFilesInBatches(uniqueFiles, options);

      const endTime = Date.now();
      
      return {
        files: fileResults,
        summary: {
          totalFiles: fileResults.length,
          scanTime: endTime - startTime,
          patterns: normalizedPatterns,
          options: scanOptions
        }
      };

    } catch (error) {
      throw new Error(`File scanning failed: ${error.message}`);
    }
  }

  /**
   * Process files in batches to avoid overwhelming the system
   * @param {Array} filePaths - Array of file paths to process
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Array of processed file data
   */
  async processFilesInBatches(filePaths, options = {}) {
    const batchSize = options.batchSize || 10;
    const results = [];
    
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(filePath => this.getFileMetadata(filePath, options))
      );

      // Process batch results, filtering out failures
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.warn(`Failed to process file ${batch[index]}: ${result.reason.message}`);
        }
      });
    }

    return results;
  }

  /**
   * Get comprehensive metadata for a single file
   * @param {string} filePath - Path to the file
   * @param {Object} options - Options for metadata extraction
   * @returns {Promise<Object>} File metadata object
   */
  async getFileMetadata(filePath, options = {}) {
    try {
      const stats = await fs.stat(filePath);
      
      // Skip files that are too large
      if (stats.size > this.config.maxFileSize) {
        return {
          path: filePath,
          error: `File too large: ${stats.size} bytes (max: ${this.config.maxFileSize})`
        };
      }

      const fileData = {
        path: filePath,
        absolutePath: path.resolve(filePath),
        relativePath: path.relative(process.cwd(), filePath),
        fileName: path.basename(filePath),
        extension: path.extname(filePath),
        directory: path.dirname(filePath),
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        type: this.getFileType(filePath)
      };

      // Add content if requested
      if (options.includeContent) {
        fileData.content = await this.readFileContent(filePath);
        fileData.lines = fileData.content.split('\n').length;
        fileData.isEmpty = fileData.content.trim().length === 0;
      }

      // Add code analysis if it's a source file
      if (options.analyzeCode && this.isSourceFile(filePath)) {
        fileData.codeAnalysis = await this.analyzeSourceFile(filePath, fileData.content);
      }

      return fileData;

    } catch (error) {
      return {
        path: filePath,
        error: error.message
      };
    }
  }

  /**
   * Read file content with encoding detection
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} File content
   */
  async readFileContent(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Try UTF-8 first, fall back to binary if needed
      try {
        return buffer.toString('utf8');
      } catch {
        return buffer.toString('binary');
      }
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Analyze source code files for patterns and metrics
   * @param {string} filePath - Path to source file
   * @param {string} content - File content (optional, will read if not provided)
   * @returns {Promise<Object>} Code analysis results
   */
  async analyzeSourceFile(filePath, content = null) {
    if (!content) {
      content = await this.readFileContent(filePath);
    }

    const analysis = {
      // Basic metrics
      lines: content.split('\n').length,
      nonEmptyLines: content.split('\n').filter(line => line.trim().length > 0).length,
      
      // React Native specific patterns
      isReactComponent: /import.*React/.test(content) && /(function|class|const).*=.*=>|extends.*Component/.test(content),
      isTypeScript: path.extname(filePath) === '.ts' || path.extname(filePath) === '.tsx',
      
      // i18n patterns
      i18nUsage: this.analyzeI18nUsage(content),
      
      // Component patterns
      componentPatterns: this.analyzeComponentPatterns(content),
      
      // Import/export analysis
      imports: this.extractImports(content),
      exports: this.extractExports(content)
    };

    return analysis;
  }

  /**
   * Analyze i18n usage in source code
   * @param {string} content - File content
   * @returns {Object} i18n analysis results
   */
  analyzeI18nUsage(content) {
    const i18nKeyRegex = /i18n\.t\(['"`]([^'"`]+)['"`]\)/g;
    const hardcodedTextRegex = />\s*([A-Za-z][^<{]+?)\s*</g;
    
    const usedKeys = [];
    const hardcodedStrings = [];
    
    let match;
    
    // Find i18n key usage
    while ((match = i18nKeyRegex.exec(content)) !== null) {
      usedKeys.push({
        key: match[1],
        line: this.getLineNumber(content, match.index)
      });
    }
    
    // Find potential hardcoded strings
    while ((match = hardcodedTextRegex.exec(content)) !== null) {
      const text = match[1].trim();
      if (this.shouldFlagAsHardcoded(text)) {
        hardcodedStrings.push({
          text: text,
          line: this.getLineNumber(content, match.index)
        });
      }
    }
    
    return {
      usedKeys,
      hardcodedStrings,
      hasI18nImport: /import.*i18n/.test(content),
      keyCount: usedKeys.length,
      hardcodedCount: hardcodedStrings.length
    };
  }

  /**
   * Analyze React Native component patterns
   * @param {string} content - File content
   * @returns {Object} Component analysis results
   */
  analyzeComponentPatterns(content) {
    return {
      hasAccessibilityLabels: /accessibilityLabel/.test(content),
      hasTestIds: /testID/.test(content),
      hasInlineStyles: /style=\{\{[^}]+\}\}/.test(content),
      hasPressableElements: /(Pressable|TouchableOpacity|Button)/.test(content),
      hasTextInputs: /TextInput/.test(content),
      hasImages: /<Image/.test(content),
      usesStyleSheet: /StyleSheet\.create/.test(content),
      hasMappedComponents: /\.map\([^)]*\)\s*=>\s*</.test(content)
    };
  }

  /**
   * Extract import statements from source code
   * @param {string} content - File content
   * @returns {Array} Array of import objects
   */
  extractImports(content) {
    const importRegex = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]*\})|(?:\w+(?:\s*,\s*\{[^}]*\})?))?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const imports = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        module: match[1],
        line: this.getLineNumber(content, match.index),
        statement: match[0]
      });
    }

    return imports;
  }

  /**
   * Extract export statements from source code
   * @param {string} content - File content
   * @returns {Array} Array of export objects
   */
  extractExports(content) {
    const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var)?\s*([^=\s;]+)/g;
    const exports = [];
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        name: match[1],
        line: this.getLineNumber(content, match.index),
        statement: match[0]
      });
    }

    return exports;
  }

  /**
   * Get line number for a given index in content
   * @param {string} content - File content
   * @param {number} index - Character index
   * @returns {number} Line number (1-based)
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Check if text should be flagged as hardcoded
   * @param {string} text - Text to check
   * @returns {boolean} Whether text should be flagged
   */
  shouldFlagAsHardcoded(text) {
    const excludePatterns = [
      /^[{}$]/,           // Template literals
      /^\d+$/,            // Numbers only
      /^[a-z]{1,3}$/,     // Short codes like 'px', 'em'
      /^#[0-9a-fA-F]+$/,  // Hex colors
      /^[A-Z_]+$/,        // Constants
      /^className$/,      // React props
      /^testID$/,         // Test identifiers
    ];

    return text.length > 3 && 
           !excludePatterns.some(pattern => pattern.test(text)) &&
           !/^\s*$/.test(text);
  }

  /**
   * Determine file type based on extension and content
   * @param {string} filePath - Path to file
   * @returns {string} File type
   */
  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // React Native source files
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      if (fileName.includes('.test.') || fileName.includes('.spec.')) {
        return 'test';
      }
      if (filePath.includes('/components/')) {
        return 'component';
      }
      return 'source';
    }

    // Translation files
    if (ext === '.json' && 
        (filePath.includes('/locales/') || 
         filePath.includes('/translations/') || 
         fileName.includes('i18n') ||
         fileName === 'en.json')) {
      return 'translation';
    }

    // Configuration files
    if (['package.json', 'tsconfig.json', '.eslintrc.json'].includes(fileName)) {
      return 'config';
    }

    return 'other';
  }

  /**
   * Check if file is a source code file
   * @param {string} filePath - Path to file
   * @returns {boolean} Whether file is source code
   */
  isSourceFile(filePath) {
    const type = this.getFileType(filePath);
    return ['source', 'component', 'test'].includes(type);
  }

  /**
   * Scan for React Native components specifically
   * @param {Object} options - Scanning options
   * @returns {Promise<Object>} Component scan results
   */
  async scanComponents(options = {}) {
    const patterns = options.patterns || this.config.componentPatterns;
    return this.scanFiles(patterns, {
      ...options,
      includeContent: true,
      analyzeCode: true
    });
  }

  /**
   * Scan for translation files
   * @param {Object} options - Scanning options
   * @returns {Promise<Object>} Translation scan results
   */
  async scanTranslations(options = {}) {
    const patterns = options.patterns || this.config.translationPatterns;
    return this.scanFiles(patterns, {
      ...options,
      includeContent: true
    });
  }

  /**
   * Scan for test files
   * @param {Object} options - Scanning options
   * @returns {Promise<Object>} Test scan results
   */
  async scanTests(options = {}) {
    const patterns = options.patterns || this.config.testPatterns;
    return this.scanFiles(patterns, {
      ...options,
      includeContent: false
    });
  }

  /**
   * Generate comprehensive project summary
   * @param {Object} options - Summary options
   * @returns {Promise<Object>} Project summary
   */
  async generateProjectSummary(options = {}) {
    const startTime = Date.now();

    try {
      const [sourceFiles, components, translations, tests] = await Promise.all([
        this.scanFiles(this.config.sourcePatterns, { includeContent: false }),
        this.scanComponents({ includeContent: true }),
        this.scanTranslations({ includeContent: true }),
        this.scanTests({ includeContent: false })
      ]);

      const summary = {
        totalFiles: sourceFiles.files.length,
        components: components.files.length,
        translations: translations.files.length, 
        tests: tests.files.length,
        
        // Size metrics
        totalSize: sourceFiles.files.reduce((sum, file) => sum + (file.size || 0), 0),
        
        // Code analysis summary
        i18nSummary: this.summarizeI18nUsage(components.files),
        componentSummary: this.summarizeComponentPatterns(components.files),
        
        // Timing
        scanTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      return summary;

    } catch (error) {
      throw new Error(`Failed to generate project summary: ${error.message}`);
    }
  }

  /**
   * Summarize i18n usage across files
   * @param {Array} files - Array of file objects with code analysis
   * @returns {Object} i18n usage summary
   */
  summarizeI18nUsage(files) {
    const filesWithAnalysis = files.filter(f => f.codeAnalysis && f.codeAnalysis.i18nUsage);
    
    return {
      totalFiles: filesWithAnalysis.length,
      filesWithI18n: filesWithAnalysis.filter(f => f.codeAnalysis.i18nUsage.keyCount > 0).length,
      totalKeys: filesWithAnalysis.reduce((sum, f) => sum + f.codeAnalysis.i18nUsage.keyCount, 0),
      totalHardcodedStrings: filesWithAnalysis.reduce((sum, f) => sum + f.codeAnalysis.i18nUsage.hardcodedCount, 0),
      filesWithHardcodedText: filesWithAnalysis.filter(f => f.codeAnalysis.i18nUsage.hardcodedCount > 0).length
    };
  }

  /**
   * Summarize component patterns across files
   * @param {Array} files - Array of file objects with code analysis
   * @returns {Object} Component patterns summary
   */
  summarizeComponentPatterns(files) {
    const components = files.filter(f => f.codeAnalysis && f.codeAnalysis.isReactComponent);
    
    return {
      totalComponents: components.length,
      withAccessibilityLabels: components.filter(f => f.codeAnalysis.componentPatterns.hasAccessibilityLabels).length,
      withTestIds: components.filter(f => f.codeAnalysis.componentPatterns.hasTestIds).length,
      withInlineStyles: components.filter(f => f.codeAnalysis.componentPatterns.hasInlineStyles).length,
      usingStyleSheet: components.filter(f => f.codeAnalysis.componentPatterns.usesStyleSheet).length
    };
  }
}

module.exports = FileScanner;
