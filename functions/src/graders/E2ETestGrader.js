const { app } = require('@azure/functions');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = util.promisify(exec);

// Define the new HTTP-triggered Azure Function
app.http('E2ETestGrader', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (request, context) => {
    context.log.info('E2E Test Grader function received a request.');

    try {
      const requestBody = await request.json();
      const projectPath = requestBody.projectPath || '.'; // The path to the mobile app's code
      const testPath = requestBody.testPath; // The path to the specific Maestro .yml test file

      if (!testPath) {
        throw new Error("Missing required parameter: 'testPath'");
      }

      // --- The main logic starts here ---
      const result = await runMaestroTest(projectPath, testPath, context);
      
      return {
          status: 200,
          body: JSON.stringify(result),
          headers: { 'Content-Type': 'application/json' }
      };

    } catch (error) {
      context.log.error('Fatal error in E2E Test Grader:', error);
      return {
          status: 500,
          body: JSON.stringify({ success: false, error: error.message, details: error.stack })
      };
    }
  }
});

/**
 * Runs a Maestro test flow and grades the result.
 * @param {string} projectPath The path where the app's source code is.
 * @param {string} testPath The specific Maestro .yml file to run.
 * @param {object} context The Azure Functions context.
 */
async function runMaestroTest(projectPath, testPath, context) {
  
  context.log.info(`Preparing to run Maestro E2E test: ${testPath}`);
  
  const report = {
    testFlow: testPath,
    passed: false,
    output: "",
    duration: 0,
    screenshots: [] // We will add to this later
  };

  const startTime = Date.now();

  try {
    // --- THIS IS THE COMMAND WE ARE RUNNING ---
    // My Note for now: This assumes Maestro is installed on the machine running this function!
    context.log.info('Executing Maestro command...');
    const { stdout, stderr } = await execAsync(`maestro test ${testPath} --format=json`, {
        cwd: projectPath, // Run the command from the app's root directory
        timeout: 900000 // 15 minutes timeout, because emulators and builds can be slow
    });

    report.passed = true;
    report.output = stdout;
    context.log.info('Maestro test flow passed successfully!');
    context.log.info(stdout);
    
    // We can also try to parse the JSON output from Maestro for more details later when i am ready
    
  } catch (error) {
    report.passed = false;
    // When Maestro tests fail, the details are often in stderr or stdout
    report.output = error.stdout || error.stderr || "An unknown error occurred.";
    context.log.error('Maestro test flow failed.');
    context.log.error(report.output); // Log the full error
  }

  const endTime = Date.now();
  report.duration = Math.round((endTime - startTime) / 1000); // Duration in seconds

  const score = report.passed ? 1 : 0; // Simple binary score for now

  return {
    success: report.passed,
    score: score,
    report: report,
  };
}

// Export the function if we want to test it directly later
module.exports = { runMaestroTest };