const { app } = require('@azure/functions');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path'); // We need the 'path' module to find the config file correctly

const execAsync = util.promisify(exec);

// NOTE: This Azure function handler will now mostly be used for triggering,
// the core logic gets its config from a file.
app.http('codeQualityGrader', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log.info('Code Quality Grader function processed a request.');

        try {
            // We can pass a project path if needed, but the config is loaded from a file
            const requestBody = await request.json().catch(() => ({}));
            const projectPath = requestBody.projectPath || '.'; // The location of the app to be graded

            const result = await gradeCodeQuality(projectPath, context);
            
            return {
                status: 200,
                body: JSON.stringify(result),
                headers: { 'Content-Type': 'application/json' }
            };

        } catch (error) {
            context.log.error('Fatal error in code quality grader:', error);
            return {
                status: 500,
                body: JSON.stringify({ success: false, error: error.message })
            };
        }
    }
});

/**
 * Grades the code quality based on a configuration file.
 * @param {string} projectPath The path to the project to be graded.
 * @param {object} context The Azure Functions context object.
 * @returns {Promise<object>} A promise that resolves to the grading result.
 */
async function gradeCodeQuality(projectPath, context) {
    
    // --- STEP 1: LOAD THE CONFIGURATION FILE ---
    // This makes our function smart. It reads instructions instead of having them hardcoded.
    context.log.info('Reading instructions from qa-grader.config.json...');
    const configPath = path.resolve(projectPath, 'qa-grader.config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('Configuration file "qa-grader.config.json" not found in the project root.');
    }
    const configData = fs.readFileSync(configPath, 'utf8');
    const fullConfig = JSON.parse(configData);
    const config = fullConfig.codeQuality; // We only need the 'codeQuality' section for this grader
    
    if (!config || !config.run) {
        context.log.warn('Skipping Code Quality check because "run" is false in the config.');
        return { success: true, score: 1, report: { summary: "Skipped" } };
    }
    
    // --- STEP 2: RUN CHECKS BASED ON THE LOADED CONFIG ---
    const report = {
        linting: { run: false, passed: false, errors: [] },
        tests: { run: false, passed: false, coverage: 0, failures: [] },
        typeCheck: { run: false, passed: false, errors: [] },
    };

    let totalScore = 0;
    let maxScore = 0;

    // Run ESLint (only if config says so)
    if (config.checks.runLint) {
        report.linting.run = true;
        maxScore += config.weights.linting; // Use weight from file
        context.log.info(`Running ESLint (Weight: ${config.weights.linting})...`);
        try {
            await execAsync('npm run lint -- --format json', { cwd: projectPath, timeout: 30000 });
            report.linting.passed = true;
            totalScore += config.weights.linting; // Add score
            context.log.info('ESLint passed successfully.');
        } catch (error) {
            report.linting.passed = false;
            const output = error.stdout || error.stderr || '[]';
            report.linting.errors = parseEslintOutput(output);
            context.log.error('ESLint failed:', error.message);
        }
    }

    // Run Jest Tests (only if config says so)
    if (config.checks.runTests) {
        report.tests.run = true;
        maxScore += config.weights.tests; // Use weight from file
        context.log.info(`Running Jest tests (Weight: ${config.weights.tests})...`);
        try {
            await execAsync('npm test -- --coverage --json --outputFile=test-results.json', { cwd: projectPath, timeout: 60000 });
            report.tests.passed = true;
            totalScore += config.weights.tests; // Add score
        } catch (error) {
            report.tests.passed = false;
            const output = error.stdout || error.stderr || '';
            report.tests.failures = parseTestOutput(output);
            context.log.error('Jest tests failed:', error.message);
        }
        const testResultsPath = path.resolve(projectPath, 'test-results.json');
        if (fs.existsSync(testResultsPath)) {
            const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
            if(report.tests.passed === false) report.tests.passed = testResults.success;
            report.tests.coverage = calculateCoveragePercentage(testResults.coverageMap);
        }
    }

    // Run TypeScript type checking (only if config says so)
    if (config.checks.runTypeCheck) {
        report.typeCheck.run = true;
        maxScore += config.weights.typeCheck; // Use weight from file
        context.log.info(`Running TypeScript type check (Weight: ${config.weights.typeCheck})...`);
        try {
            await execAsync('npx tsc --noEmit', { cwd: projectPath, timeout: 30000 });
            report.typeCheck.passed = true;
            totalScore += config.weights.typeCheck;
            context.log.info('TypeScript type check passed.');
        } catch (error) {
            report.typeCheck.passed = false;
            const output = error.stdout || error.stderr || '';
            report.typeCheck.errors = parseTypeScriptOutput(output);
            context.log.error('TypeScript type check failed:', error.message);
        }
    }

    // --- STEP 3: CALCULATE FINAL SCORE BASED ON WEIGHTS ---
    const finalScore = maxScore > 0 ? (totalScore / maxScore) : 1; // Score is 1 (perfect) if no checks were run
    
    const summary = {
        overallPassed: finalScore >= (config.minimumScore || 0.7),
        score: finalScore
    };
    report.summary = summary;

    return {
        success: summary.overallPassed,
        score: finalScore,
        report,
    };
}


// These are helper functions, they remain mostly the same.
// ... (Your parseEslintOutput, parseTestOutput, parseTypeScriptOutput, calculateCoveragePercentage functions go here) ...
function parseEslintOutput(output) {
    if (typeof output !== 'string') return [{ error: 'Invalid ESLint output' }];
    try {
        const parsed = JSON.parse(output);
        const errors = [];
        parsed.forEach(file => {
            if (file.messages.length > 0) errors.push({ file: file.filePath, messages: file.messages });
        });
        return errors;
    } catch { return output ? [{ error: output }] : []; }
}
function parseTestOutput(output) {
    if (typeof output !== 'string') return [];
    return output.split('\n').filter(line => line.includes('FAIL') || /Test suite failed/.test(line));
}
function parseTypeScriptOutput(output) {
    if (typeof output !== 'string') return [];
    return output.split('\n').filter(line => line.match(/error TS\d+:/));
}
function calculateCoveragePercentage(coverageMap) {
    if (!coverageMap) return 0;
    let totalStatements = 0, coveredStatements = 0;
    for (const file in coverageMap) {
        const statements = coverageMap[file].s;
        for (const key in statements) { totalStatements++; if (statements[key] > 0) coveredStatements++; }
    }
    return totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 0;
}

module.exports = { gradeCodeQuality };