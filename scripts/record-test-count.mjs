/**
 * Record how many tests actually ran.
 *
 * The readiness document quotes a count as evidence, and a quoted count is the
 * easiest claim in a document to leave stale. This writes the figure from the
 * runner's own JSON report into a small file that `docs-fidelity.test.ts` compares
 * against, so the number cannot drift upward without the test failing.
 *
 * Run via `npm run test:count`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REPORT = path.resolve(".verify/vitest-report.json");
const OUT = path.resolve(".verify/test-counts.json");

const report = JSON.parse(await readFile(REPORT, "utf8"));

await writeFile(
  OUT,
  JSON.stringify(
    {
      tests: report.numTotalTests,
      files: report.testResults.length,
      passed: report.numPassedTests,
    },
    null,
    2,
  ),
);

console.log(`recorded ${report.numTotalTests} tests in ${report.testResults.length} files`);
