let passed = 0, failed = 0;
const failures: string[] = [];
export function test(name: string, fn: () => void | Promise<void>) {
  queue.push({ name, fn });
}
const queue: { name: string; fn: () => void | Promise<void> }[] = [];
export function eq<T>(actual: T, expected: T, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}
export function ok(cond: unknown, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}
export async function run(title: string) {
  console.log(`\n== ${title} ==`);
  for (const t of queue) {
    const t0 = Date.now();
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name} (${Date.now() - t0}ms)`);
    } catch (e: any) {
      failed++;
      failures.push(t.name);
      console.log(`  ✗ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}
