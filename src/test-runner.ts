#!/usr/bin/env node
import { config } from 'dotenv';
import { WrapperTester, TestCase } from './test/wrapper-test.js';

// Load environment variables
config();

async function main() {
  const tester = new WrapperTester();

  // Define test cases
  const testCases: TestCase[] = [
    {
      name: "Line Counter Test",
      scriptPath: "./scripts/line_counter/line_counter.sh",
      readmePath: "./scripts/line_counter/README.md", 
      exampleCommand: "./scripts/line_counter/line_counter.sh 'Hello\\nWorld'",
      expectedOutput: "Line Count: 2"
    },
    {
      name: "Vowel Counter Test",
      scriptPath: "./scripts/vowel_counter/vowel_counter.js",
      readmePath: "./scripts/vowel_counter/README.md",
      exampleCommand: "node scripts/vowel_counter/vowel_counter.js 'Hello world'",
      expectedOutput: "Vowel Count: 3"
    }
  ];

  // Run test suite
  const summary = await tester.runTestSuite(testCases);
  
  if (summary.failed > 0) {
    console.error(`❌ ${summary.failed} test(s) failed`);
    process.exit(1);
  } else {
    console.error(`✅ All ${summary.passed} test(s) passed!`);
  }
}

main().catch(console.error);
