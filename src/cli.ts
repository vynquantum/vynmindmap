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
 *   vynmm info map.vmm                   summarize a .vmm
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import {
  createWorkbook,
  markdownToWorkbook,
  readVmm,
  walkSheetTopics,
  workbookToMarkdown,
  writeVmm,
} from "./index.js";

function parseArgs(argv: string[]): { _: string[]; out?: string } {
  const positional: string[] = [];
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-o" || a === "--out") out = argv[++i];
    else positional.push(a);
  }
  return { _: positional, out };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";
}

const USAGE = `vynmm — mind-map (.vmm) command-line tool

Usage:
  vynmm new "<title>" [-o file.vmm]
  vynmm import <input.md> [-o output.vmm]
  vynmm export <input.vmm> [-o output.md]
  vynmm info <input.vmm>
`;

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  const { _, out } = parseArgs(rest);

  switch (cmd) {
    case "new": {
      const title = _[0] ?? "Central Topic";
      const wb = createWorkbook(title);
      const file = out ?? `${slug(title)}.vmm`;
      writeFileSync(file, writeVmm(wb));
      console.log(`Created ${file}`);
      break;
    }
    case "import": {
      const input = _[0];
      if (!input) fail("import: missing <input.md>");
      const md = readFileSync(input!, "utf8");
      const wb = markdownToWorkbook(md);
      const file = out ?? input!.replace(/\.md$/i, "") + ".vmm";
      writeFileSync(file, writeVmm(wb));
      console.log(`Imported ${input} → ${file} (${wb.sheets.length} sheet(s))`);
      break;
    }
    case "export": {
      const input = _[0];
      if (!input) fail("export: missing <input.vmm>");
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
    case "info": {
      const input = _[0];
      if (!input) fail("info: missing <input.vmm>");
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
    case "-h":
    case "--help":
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
