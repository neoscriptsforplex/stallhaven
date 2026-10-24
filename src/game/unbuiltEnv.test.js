import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// GitHub Pages serves src/ unbuilt, so import.meta.env is undefined there.
// A bare `import.meta.env.X` outside try/catch throws and hung save loading (hotfix).
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.js') && !d.name.includes('.test.') ? [join(dir, d.name)] : []);
}

describe('unbuilt Pages safety', () => {
  it('every bare import.meta.env access sits inside a try block or uses ?.', () => {
    const bad = [];
    for (const f of files('src')) {
      const lines = readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/import\.meta\.env\.[A-Z_]/.test(line)) return;
        const before = lines.slice(Math.max(0, i - 4), i).join('\n');
        if (/try\s*\{/.test(before)) return;
        bad.push(`${f}:${i + 1}`);
      });
    }
    assert.deepEqual(bad, []);
  });
});
