import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWorkbook, readVmm, writeVmm } from '../src/index.js';

/**
 * Drives the real `vynmm` CLI. The point is the resource guard: Markdown can
 * reference `resources/logo.png` but never carries its bytes, so importing an
 * edited export back over the file must not delete the pictures.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'vynmm-cli-'));
const vynmm = (...args: string[]) =>
  execFileSync('npx', ['tsx', 'src/cli.ts', ...args], {
    cwd: root,
    shell: process.platform === 'win32'
  });

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('vynmm CLI', () => {
  it('keeps the embedded images when re-importing an edited export', () => {
    const file = join(tmp, 'pics.vmm');
    const wb = createWorkbook('Pics');
    wb.sheets[0]!.rootTopic.image = { resource: 'resources/logo.png' };
    writeFileSync(file, writeVmm(wb, { 'resources/logo.png': new Uint8Array([1, 2, 3]) }));

    const md = join(tmp, 'pics.md');
    vynmm('export', file, '-o', md);
    vynmm('import', md, '-o', file);

    const back = readVmm(readFileSync(file));
    expect(back.resources['resources/logo.png']).toEqual(new Uint8Array([1, 2, 3]));
    expect(back.workbook.sheets[0]!.rootTopic.image).toEqual({ resource: 'resources/logo.png' });
  }, 60000);
});
