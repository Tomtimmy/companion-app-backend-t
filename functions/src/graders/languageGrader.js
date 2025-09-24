const { app } = require('@azure/functions');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');

// Language Implementation Grader Function
app.http('languageGrader', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Language Grader function processed a request.');

        try {
            const requestBody = await request.json().catch(() => ({}));
            const config = {
                translationFile: requestBody.translationFile || './store/en.json',
                sourcePattern: requestBody.sourcePattern || './**/*.{js,jsx,ts,tsx}',
                ignorePattern: requestBody.ignorePattern || 'node_modules/**',
                strictMode: requestBody.strictMode || false,
                ...requestBody
            };

            const result = await gradeLanguageImplementation(config, context);
            
            return {
                status: result.success ? 200 : 400,
                body: JSON.stringify({
                    success: result.success,
                    score: result.score,
                    report: result.report,
                    timestamp: new Date().toISOString(),
                    config: config
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };

        } catch (error) {
            context.log.error('Error in language grader:', error);
            return {
                status: 500,
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }
});

async function gradeLanguageImplementation(config, context) {
    const report = {
        missingKeys: [],
        hardcodedStrings: [],
        unusedKeys: [],
        malformedKeys: [],
        summary: {}
    };

    let translations = {};
    
    // Load translation file
    try {
        if (fs.existsSync(config.translationFile)) {
            const data = fs.readFileSync(config.translationFile, 'utf8');
            translations = JSON.parse(data);
        } else {
            throw new Error(`Translation file not found: ${config.translationFile}`);
        }
    } catch (error) {
        return {
            success: false,
            score: 0,
            report: {
                error: `Failed to load translation file: ${error.message}`
            }
        };
    }

    // Patterns for detecting i18n usage and hardcoded text
    const I18N_REGEX = /i18n\.t\(['"`]([^'"`]+)['"`]\)/g;
    const HARDCODED_TEXT_REGEX = />\s*([A-Za-z][^<{]+?)\s*</g;

    // Get all source files
    const srcFiles = glob.sync(config.sourcePattern, { 
        ignore: config.ignorePattern,
        nodir: true 
    });

    context.log(`Scanning ${srcFiles.length} files...`);

    let usedKeys = new Set();

    // Scan each file
    for (const file of srcFiles) {
        try {
            const code = fs.readFileSync(file, 'utf8');
            
            // Check for i18n key usage
            let match;
            while ((match = I18N_REGEX.exec(code)) !== null) {
                const key = match[1];
                usedKeys.add(key);

                // Check if key exists in translations
                if (!resolveKey(translations, key)) {
                    report.missingKeys.push({ file, key });
                }

                // Check for bracket notation (should use dot notation)
                if (key.includes('[') && key.includes(']')) {
                    report.malformedKeys.push({ 
                        file, 
                        key, 
                        issue: 'Use dot notation instead of bracket notation' 
                    });
                }
            }

            // Check for hardcoded strings in JSX
            let hcMatch;
            while ((hcMatch = HARDCODED_TEXT_REGEX.exec(code)) !== null) {
                const text = hcMatch[1].trim();
                if (shouldFlagAsHardcoded(text)) {
                    report.hardcodedStrings.push({ file, text });
                }
            }

        } catch (error) {
            context.log.warn(`Error scanning file ${file}:`, error.message);
        }
    }

    // Find unused translation keys
    const allTranslationKeys = extractAllKeys(translations);
    for (const key of allTranslationKeys) {
        if (!usedKeys.has(key)) {
            report.unusedKeys.push(key);
        }
    }

    // Calculate score
    const score = calculateScore(report, config);
    
    // Generate summary
    report.summary = {
        filesScanned: srcFiles.length,
        totalKeys: allTranslationKeys.length,
        usedKeys: usedKeys.size,
        missingKeysCount: report.missingKeys.length,
        hardcodedStringsCount: report.hardcodedStrings.length,
        unusedKeysCount: report.unusedKeys.length,
        malformedKeysCount: report.malformedKeys.length,
        score: score
    };

    const success = score >= (config.minimumScore || 0.8);

    return {
        success,
        score,
        report
    };
}

function resolveKey(obj, key) {
    const parts = key.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (Array.isArray(current)) {
            if (isNaN(part)) return undefined;
            current = current[parseInt(part)];
        } else if (current && Object.prototype.hasOwnProperty.call(current, part)) {
            current = current[part];
        } else {
            return undefined;
        }
    }
    
    return current;
}

function shouldFlagAsHardcoded(text) {
    // Filter out obvious non-user-facing strings
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

function extractAllKeys(obj, prefix = '') {
    let keys = [];
    
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...extractAllKeys(value, fullKey));
        } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    keys.push(...extractAllKeys(item, `${fullKey}.${index}`));
                } else {
                    keys.push(`${fullKey}.${index}`);
                }
            });
        } else {
            keys.push(fullKey);
        }
    }
    
    return keys;
}

function calculateScore(report, config) {
    const weights = {
        missingKeys: config.missingKeyWeight || 0.4,
        hardcodedStrings: config.hardcodedWeight || 0.3,
        malformedKeys: config.malformedWeight || 0.2,
        unusedKeys: config.unusedKeyWeight || 0.1
    };

    const penalties = {
        missingKeys: report.missingKeys.length * weights.missingKeys,
        hardcodedStrings: report.hardcodedStrings.length * weights.hardcodedStrings,
        malformedKeys: report.malformedKeys.length * weights.malformedKeys,
        unusedKeys: report.unusedKeys.length * weights.unusedKeys
    };

    const totalPenalty = Object.values(penalties).reduce((sum, penalty) => sum + penalty, 0);
    const maxPossibleScore = 1.0;
    
    return Math.max(0, maxPossibleScore - (totalPenalty / 10)); // Normalize penalties
}

module.exports = { gradeLanguageImplementation, resolveKey, extractAllKeys };
