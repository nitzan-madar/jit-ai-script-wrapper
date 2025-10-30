import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { basename } from 'path';
import { LLMFactory } from '../llm-factory.js';
import { sanitizeDockerfile, parseExample } from '../sanitize.js';
import { dockerBuildWithContext, dockerRun } from '../docker.js';
import { verifyOutput } from '../verify.js';

export interface TestCase {
  name: string;
  scriptPath: string;
  readmePath: string;
  exampleCommand: string;
  expectedOutput: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: {
    dockerfileGenerated: boolean;
    dockerBuildSucceeded: boolean;
    containerRanSuccessfully: boolean;
    outputMatched: boolean;
    actualOutput?: string;
  };
}

export class WrapperTester {
  async runTest(testCase: TestCase): Promise<TestResult> {
    const result: TestResult = {
      name: testCase.name,
      passed: false,
      details: {
        dockerfileGenerated: false,
        dockerBuildSucceeded: false,
        containerRanSuccessfully: false,
        outputMatched: false
      }
    };

    try {
      console.error(`🧪 Running test: ${testCase.name}`);

      // Read script and README
      const scriptContent = readFileSync(testCase.scriptPath, 'utf-8');
      const scriptFilename = basename(testCase.scriptPath);
      const readmeContent = readFileSync(testCase.readmePath, 'utf-8');

      // Parse example command
      const { containerArgs } = parseExample(testCase.exampleCommand, scriptFilename);
      const exampleInsideContainer = `/${scriptFilename} ${containerArgs.join(' ')}`;

      // Generate Dockerfile
      console.error(`  📝 Generating Dockerfile...`);
      const llmProvider = LLMFactory.createFromEnv();
      const dockerfile = await llmProvider.generateDockerfile({
        filename: scriptFilename,
        script: scriptContent,
        readme: readmeContent,
        exampleInsideContainer
      });

      const sanitizedDockerfile = sanitizeDockerfile(dockerfile);
      result.details!.dockerfileGenerated = true;
      console.error(`  ✅ Dockerfile generated`);

      // Build Docker image
      const tag = `test-${scriptFilename.replace(/[^a-z0-9]/g, '-').toLowerCase()}-${Date.now()}`;
      console.error(`  🔨 Building Docker image: ${tag}`);
      
      await dockerBuildWithContext(tag, {
        scriptPath: testCase.scriptPath,
        dockerfile: sanitizedDockerfile,
        scriptFilename: scriptFilename
      });
      result.details!.dockerBuildSucceeded = true;
      console.error(`  ✅ Docker build succeeded`);

      // Run container
      console.error(`  🚀 Running container...`);
      const runResult = await dockerRun(tag, containerArgs);
      
      if (runResult.exitCode === 0) {
        result.details!.containerRanSuccessfully = true;
        result.details!.actualOutput = runResult.stdout;
        console.error(`  ✅ Container ran successfully`);

        // Verify output
        const verification = verifyOutput(runResult, testCase.expectedOutput);
        result.details!.outputMatched = verification;
        
        if (verification) {
          console.error(`  ✅ Output verification passed`);
          result.passed = true;
        } else {
          console.error(`  ❌ Output verification failed`);
          console.error(`    Expected: "${testCase.expectedOutput}"`);
          console.error(`    Got: "${runResult.stdout}"`);
          result.error = `Output mismatch. Expected: "${testCase.expectedOutput}", Got: "${runResult.stdout}"`;
        }
      } else {
        console.error(`  ❌ Container failed with exit code: ${runResult.exitCode}`);
        console.error(`    stderr: ${runResult.stderr}`);
        result.error = `Container exited with code ${runResult.exitCode}: ${runResult.stderr}`;
      }

    } catch (error) {
      console.error(`  ❌ Test failed: ${error}`);
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  async runTestSuite(testCases: TestCase[]): Promise<{ passed: number; failed: number; results: TestResult[] }> {
    console.error(`🧪 Running test suite with ${testCases.length} test cases`);
    console.error('='.repeat(60));

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
      const result = await this.runTest(testCase);
      results.push(result);
      
      if (result.passed) {
        passed++;
        console.error(`✅ ${result.name} - PASSED`);
      } else {
        failed++;
        console.error(`❌ ${result.name} - FAILED: ${result.error}`);
      }
      console.error('');
    }

    console.error('='.repeat(60));
    console.error(`📊 Test Results: ${passed} passed, ${failed} failed`);
    
    return { passed, failed, results };
  }
}
