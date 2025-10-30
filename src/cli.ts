#!/usr/bin/env node
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import { LLMFactory } from './llm-factory.js';
import { sanitizeDockerfile, parseExample } from './sanitize.js';
import { dockerBuild, dockerRun, dockerBuildWithContext } from './docker.js';
import { verifyOutput } from './verify.js';
import { InputSanitizer } from './security.js';

// Load environment variables
config();

async function main() {
  // Parse command line arguments
  const allArgs = process.argv.slice(2);
  const hasForceFlag = allArgs.includes('--force');
  const args = allArgs.filter(arg => arg !== '--force'); // Remove --force from main args
  
  // Support multiple modes - FULL WORKFLOW IS DEFAULT per assignment requirements
  // Default: npm start <script> <readme> (full build & test workflow)
  // Optional: npm start <script> <readme> <example> [expected] (custom example)
  // Generate-only: npm start <script> <readme> --generate-only
  if (args.length < 2 || args.length > 4) {
    console.error('Usage:');
    console.error('  Full Workflow:  npm start <script-path> <readme-path>');
    console.error('  Custom Example: npm start <script-path> <readme-path> <example-command> [expected-output]');
    console.error('  Generate Only:  npm start <script-path> <readme-path> --generate-only');
    console.error('  Security bypass: Add --force flag (not recommended)');
    console.error('');
    console.error('Examples:');
    console.error('  npm start ./scripts/vowel_counter/vowel_counter.js ./scripts/vowel_counter/README.md');
    console.error('  npm start ./scripts/line_counter/line_counter.sh ./scripts/line_counter/README.md "./scripts/line_counter/line_counter.sh \'Hello\\nWorld\'" "Line Count: 2"');
    console.error('  npm start ./script.py ./README.md --generate-only');
    process.exit(1);
  }

  const generateOnlyFlag = allArgs.includes('--generate-only');
  const cleanArgs = args.filter(arg => arg !== '--generate-only');
  const [scriptPath, readmePath, exampleCommand, expectedOutput] = cleanArgs;
  const fullMode = !generateOnlyFlag; // Full workflow is DEFAULT

  try {
    // Validate LLM configuration
    try {
      const { Config } = await import('./config.js');
      const config = Config.getValidatedConfig();
      console.error(`🤖 Using ${config.provider} (${config.model}) with temperature ${config.temperature}`);
    } catch (configError) {
      console.error('Error: LLM configuration is invalid');
      console.error(configError instanceof Error ? configError.message : String(configError));
      console.error('');
      console.error('Set environment variables:');
      console.error('  LLM_API_KEY=your-api-key (or OPENAI_API_KEY for backward compatibility)');
      console.error('  LLM_PROVIDER=openai (optional, defaults to openai)');
      console.error('  LLM_MODEL=gpt-4o-mini (optional)');
      console.error('  LLM_TEMPERATURE=0.1 (optional)');
      process.exit(1);
    }

    // Read script file
    const scriptContent = readFileSync(scriptPath, 'utf-8');
    const scriptFilename = basename(scriptPath);

    // Read README file
    const readmeContent = readFileSync(readmePath, 'utf-8');

    // Security scan inputs
    console.error('🔒 Performing security scan...');
    const securityResults = InputSanitizer.sanitizeAllInputs(scriptPath, scriptContent, readmeContent);
    
    // Report security warnings
    const allWarnings = [
      ...securityResults.scriptPath.warnings.map(w => `Script path: ${w}`),
      ...securityResults.script.warnings.map(w => `Script: ${w}`),
      ...securityResults.readme.warnings.map(w => `README: ${w}`)
    ];

    if (allWarnings.length > 0) {
      console.error('⚠️  Security warnings:');
      allWarnings.forEach(warning => console.error(`  - ${warning}`));
      
      if (!securityResults.overallSafe) {
        console.error('❌ Security scan failed: Potentially dangerous content detected');
        console.error('Use --force to bypass security checks (not recommended)');
        if (!hasForceFlag) {
          process.exit(1);
        } else {
          console.error('⚠️  Bypassing security checks due to --force flag');
        }
      }
    } else {
      console.error('✅ Security scan passed');
    }

    // Determine example command to use
    let finalExampleCommand: string;
    if (exampleCommand) {
      // Use provided example command
      finalExampleCommand = exampleCommand;
    } else {
      // Extract example usage from README - look for the Example section
      const exampleSectionMatch = readmeContent.match(/## Example[\s\S]*?```(?:bash|shell)?\s*\n([^\n`]+)/);
      if (exampleSectionMatch) {
        finalExampleCommand = exampleSectionMatch[1].trim();
      } else {
        // Fallback to a reasonable default
        finalExampleCommand = `node ${scriptFilename} 'Hello world'`;
      }
    }
    
    // Parse the example to get container arguments
    const { containerArgs } = parseExample(finalExampleCommand, scriptFilename);
    const exampleInsideContainer = `/${scriptFilename} ${containerArgs.join(' ')}`;

    console.error(`${fullMode ? 'Building & Testing' : 'Generating Dockerfile for'}: ${scriptFilename}`);
    console.error(`Using example: ${finalExampleCommand}`);
    console.error(`Container command: ${exampleInsideContainer}`);
    console.error('---');

    // Generate Dockerfile using LLM factory
    const llmProvider = LLMFactory.createFromEnv();
    const dockerfile = await llmProvider.generateDockerfile({
      filename: scriptFilename,
      script: scriptContent,
      readme: readmeContent,
      exampleInsideContainer
    });

    // Sanitize the generated Dockerfile
    const sanitizedDockerfile = sanitizeDockerfile(dockerfile);

    if (!fullMode) {
      // Generate-only mode: Output the Dockerfile to stdout
      console.log(sanitizedDockerfile);
      return;
    }

    // Full mode: Build, Test, and Verify
    console.error('✅ Dockerfile generated successfully');

    // Generate unique tag for this build
    const tag = `nitzanscriptwrap-${scriptFilename.replace(/[^a-z0-9]/g, '-').toLowerCase()}-${Date.now()}`;
    
    try {
      // Build Docker image with proper context
      console.error('🔨 Building Docker image...');
      await dockerBuildWithContext(tag, {
        scriptPath: scriptPath,
        dockerfile: sanitizedDockerfile,
        scriptFilename: scriptFilename
      });
      console.error('✅ Docker image built successfully');

      // Run the container with the example command
      console.error('🚀 Running container with example...');
      const result = await dockerRun(tag, containerArgs);
      
      console.error(`📤 Container output:`);
      console.error(`stdout: ${result.stdout}`);
      console.error(`stderr: ${result.stderr}`);
      console.error(`exit code: ${result.exitCode}`);

      // Verify output if expected result provided
      if (expectedOutput) {
        const isValid = verifyOutput(result, expectedOutput);
        console.error(`🔍 Verification: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
        if (isValid) {
          console.error(`✅ Output matches expected: "${expectedOutput}"`);
        } else {
          console.error(`❌ Expected: "${expectedOutput}"`);
          console.error(`❌ Got: "${result.stdout}"`);
          process.exit(1);
        }
      } else {
        // Just check if container ran successfully
        if (result.exitCode === 0) {
          console.error('✅ Container executed successfully');
        } else {
          console.error('❌ Container failed to execute');
          process.exit(1);
        }
      }

      console.error('🎉 All tests passed! Dockerfile is working correctly.');
      
      // Output the successful Dockerfile
      console.log(sanitizedDockerfile);

    } finally {
      // Clean up: remove the temporary Dockerfile
      try {
        const fs = await import('fs');
        fs.unlinkSync('Dockerfile');
        console.error('🧹 Cleaned up temporary Dockerfile');
      } catch (e) {
        // Ignore cleanup errors
      }
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(console.error);
