#!/usr/bin/env node
/**
 * `vynmm` — command-line interface for `.vmm` files.
 *
 * Scriptable and AI-friendly: lets a script or LLM create maps, and convert
 * between `.vmm` and Markdown without opening the app.
 *
 *   vynmm new "My Map" [-o map.vmm]      create a new map
 *   vynmm import notes.md [-o notes.vmm] Markdown → .vmm
 *   vynmm export map.vmm [-o map.md]     .vmm → Markdown (stdout if no -o)
 *   vynmm merge a.vmm b.md [-o all.vmm]  many files → one, a tab per sheet
 *   vynmm info map.vmm                   summarize a .vmm
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import {
  createWorkbook,
  markdownToWorkbook,
  mergeDocuments,
  newDocument,
  readVmm,
  walkSheetTopics,
  workbookToMarkdown,
  writeVmm,
  type VmmDocument
} from './index.js';

function parseArgs(argv: string[]): { _: string[]; out?: string } {
  const positional: string[] = [];
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-o' || a === '--out') out = argv[++i];
    else positional.push(a);
  }
  return { _: positional, out };
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}

/** Read either lane into a document, so `merge` can take a mix of both. */
function readDocument(file: string): VmmDocument {
  if (/\.(md|markdown|txt)$/i.test(file)) {
    return newDocument(markdownToWorkbook(readFileSync(file, 'utf8')));
  }
  return readVmm(readFileSync(file));
}

const USAGE = `vynmm — mind-map (.vmm) command-line tool

Usage:
  vynmm new "<title>" [-o file.vmm]
  vynmm import <input.md> [-o output.vmm]
  vynmm export <input.vmm> [-o output.md]
  vynmm merge <input...> [-o merged.vmm]   .vmm and/or .md, one tab per sheet
  vynmm info <input.vmm>
`;

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  const { _, out } = parseArgs(rest);

  switch (cmd) {
    case 'new': {
      const title = _[0] ?? 'Central Topic';
      const wb = createWorkbook(title);
      const file = out ?? `${slug(title)}.vmm`;
      writeFileSync(file, writeVmm(wb));
      console.log(`Created ${file}`);
      break;
    }
    case 'import': {
      const input = _[0];
      if (!input) fail('import: missing <input.md>');
      // Several files import as one map, a tab per file, same as `merge`.
      const wb =
        _.length > 1
          ? mergeDocuments(_.map(readDocument)).workbook
          : markdownToWorkbook(readFileSync(input, 'utf8'));
      const file = out ?? input.replace(/\.md$/i, '') + '.vmm';
      // Re-importing an edited export must not delete the pictures: Markdown
      // references resources but can't carry their bytes, so keep the ones
      // already in the file we're about to overwrite.
      writeFileSync(
        file,
        writeVmm(wb, existsSync(file) ? readVmm(readFileSync(file)).resources : {})
      );
      console.log(`Imported ${_.join(', ')} → ${file} (${wb.sheets.length} sheet(s))`);
      break;
    }
    case 'export': {
      const input = _[0];
      if (!input) fail('export: missing <input.vmm>');
      const { workbook } = readVmm(readFileSync(input!));
      const md = workbookToMarkdown(workbook);
      if (out) {
        writeFileSync(out, md);
        console.log(`Exported ${input} → ${out}`);
      } else {
        process.stdout.write(md);
      }
      break;
    }
    case 'merge': {
      if (_.length < 2) fail('merge: give at least two input files');
      const docs = _.map(readDocument);
      const merged = mergeDocuments(docs);
      const file = out ?? 'merged.vmm';
      writeFileSync(file, writeVmm(merged.workbook, merged.resources));
      console.log(
        `Merged ${_.length} file(s) → ${file} (${merged.workbook.sheets.length} sheet(s): ` +
          `${merged.workbook.sheets.map((s) => `"${s.title}"`).join(', ')})`
      );
      break;
    }
    case 'info': {
      const input = _[0];
      if (!input) fail('info: missing <input.vmm>');
      const { workbook, manifest } = readVmm(readFileSync(input!));
      console.log(`${basename(input!)}`);
      console.log(`  format version: ${manifest.formatVersion}`);
      console.log(`  app: ${manifest.app} ${manifest.appVersion}`);
      console.log(`  sheets: ${workbook.sheets.length}`);
      for (const s of workbook.sheets) {
        const count = [...walkSheetTopics(s)].length;
        console.log(`    - "${s.title}" [${s.structure}] — ${count} topics`);
      }
      break;
    }
    case undefined:
    case '-h':
    case '--help':
      process.stdout.write(USAGE);
      break;
    default:
      fail(`unknown command: ${cmd}`);
  }
}

function fail(msg: string): never {
  console.error(`vynmm: ${msg}\n`);
  process.stderr.write(USAGE);
  process.exit(1);
}

main();
