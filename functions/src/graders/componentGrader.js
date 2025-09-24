const { app } = require('@azure/functions');
const glob = require('glob');
const fs = require('fs');
const path = require('path'); // Add 'path' so we can find the config file

// The main Azure Function entry point (we don't need to change much here)
app.http('componentGrader', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log.info('Component Grader function processed a request.');
    try {
        const requestBody = await request.json().catch(() => ({}));
        const projectPath = requestBody.projectPath || '.';
        const result = await gradeComponents(projectPath, context);
        return { body: JSON.stringify(result) };
    } catch (error) {
        context.log.error('Fatal error in component grader:', error);
        return { status: 500, body: JSON.stringify({ success: false, error: error.message })};
    }
  }
});

/**
 * Grades React Native components based on rules in a config file.
 * @param {string} projectPath The path to the project to be graded.
 * @param {object} context The Azure Functions context object.
 * @returns {Promise<object>} A promise that resolves to the grading result.
 */
async function gradeComponents(projectPath, context) {
    // --- STEP 1: LOAD THE CONFIGURATION FILE ---
    context.log.info('Component Grader reading instructions from qa-grader.config.json...');
    const configPath = path.resolve(projectPath, 'qa-grader.config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('Configuration file "qa-grader.config.json" not found in the project root.');
    }
    const configData = fs.readFileSync(configPath, 'utf8');
    const fullConfig = JSON.parse(configData);
    const config = fullConfig.componentGrader; // We only need the 'componentGrader' section

    if (!config || !config.run) {
        context.log.warn('Skipping Component Grading because "run" is false in the config.');
        return { success: true, score: 1, report: { summary: "Skipped" } };
    }

    // --- STEP 2: FIND FILES AND RUN CHECKS BASED ON THE LOADED CONFIG ---
    const componentFiles = glob.sync(fullConfig.componentPattern || 'src/**/*.{js,jsx,ts,tsx}', { 
        ignore: fullConfig.ignorePattern 
    });
    
    context.log.info(`Analyzing ${componentFiles.length} component files...`);

    const report = {
        accessibility: [],
        testIds: [],
        bestPractices: [],
    };
    
    for (const file of componentFiles) {
        try {
            const code = fs.readFileSync(file, 'utf8');
            // We pass the config rules into the analyzer now
            analyzeComponent(file, code, report, config.rules);
        } catch (error) {
            context.log.warn(`Error analyzing file: ${file}`, error.message);
        }
    }
    
    // --- STEP 3: CALCULATE SCORE ---
    const issuesFound = report.accessibility.length + report.testIds.length + report.bestPractices.length;
    // Simple scoring: 1 point, minus 0.05 for every issue found. Cannot go below 0.
    const score = Math.max(0, 1 - (issuesFound * 0.05)); 
    
    const summary = {
        filesAnalyzed: componentFiles.length,
        issuesFound: issuesFound,
        overallPassed: score >= config.minimumScore,
    };
    report.summary = summary;

    return { success: summary.overallPassed, score, report };
}

/**
 * Analyzes a single component file based on a set of rules.
 * @param {string} file The file path of the component.
 * @param {string} code The source code of the component.
 * @param {object} report The main report object to add issues to.
 * @param {object} rules The rules object from the config file.
 */
function analyzeComponent(file, code, report, rules) {
    const lines = code.split('\n');
    const mapWithoutKeyRegex = /\.map\([\s\S]*?=>\s*\(?\s*<([A-Za-z0-9_.]+)[^>]*?(?<!\skey=|\skey={)[^>]*?>/g;
    const inlineStyleRegex = /style\s*=\s*\{\{/g;
    const interactiveComponentRegex = /<(Pressable|TouchableOpacity|Button|TextInput|Switch)([^>]*)>/g;

    lines.forEach((line, index) => {
        // Only check for map without key if the rule is enabled
        if (rules.checkMissingKeys && mapWithoutKeyRegex.test(line)) {
            report.bestPractices.push({ file, issue: 'Missing key prop in mapped component', line: index + 1 });
        }
        
        // Only check for inline styles if the rule is enabled
        if (rules.checkInlineStyles && inlineStyleRegex.test(line)) {
             report.bestPractices.push({ file, issue: 'Inline styles detected - consider using StyleSheet', line: index + 1 });
        }
        
        // Check interactive components based on rules
        let match;
        while ((match = interactiveComponentRegex.exec(line)) !== null) {
            const fullTag = match[0];
            const componentName = match[1];
            
            if (rules.checkAccessibilityLabel && !/accessibilityLabel=/.test(fullTag)) {
                report.accessibility.push({ file, issue: 'Missing accessibilityLabel', component: componentName, line: index + 1 });
            }
            if (rules.checkTestID && !/testID=/.test(fullTag)) {
                report.testIds.push({ file, issue: 'Missing testID for interactive element', component: componentName, line: index + 1 });
            }
        }
    });
}


module.exports = { gradeComponents };