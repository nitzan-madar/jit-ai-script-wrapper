export function verifyOutput(run: { stdout: string; stderr: string; exitCode: number }, expect: string | null): boolean {
  if (run.exitCode !== 0) return false;
  if (!expect) return true;
  const m = expect.match(/^\/(.*)\/$/);
  if (m) return new RegExp(m[1]).test(run.stdout);
  return run.stdout.includes(expect);
}
