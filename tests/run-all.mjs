// Runs the engine-side suites. UI suite (needs Chromium) and strength ladder are run separately.
import { spawnSync } from 'node:child_process';
const suites = ['rules', 'book', 'engine'];
let failed = 0;
for (const s of suites) {
  console.log(`\n=== ${s} ===`);
  const r = spawnSync('bash', ['tests/run.sh', `tests/${s}.test.ts`], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) FAILED` : '\nAll engine suites passed');
process.exit(failed ? 1 : 0);
