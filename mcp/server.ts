/**
 * VynMM MCP server — lets an LLM client create, read, and edit `.vmm` mind maps.
 *
 * Tools speak Markdown (the LLM-friendly projection, see src/markdown.ts), so a
 * model never has to understand the binary `.vmm` container — it reads and writes
 * outlines, and this server handles conversion to/from the canonical format.
 *
 * Run: `npm run mcp` (stdio transport). Register in an MCP client, e.g.:
 *   { "command": "npx", "args": ["tsx", "mcp/server.ts"] }
 */

import { readFileSync, writeFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  addChild,
  createWorkbook,
  markdownToWorkbook,
  readVmm,
  walkSheetTopics,
  workbookToMarkdown,
  writeVmm,
  type Topic,
  type Workbook,
} from "../src/index.js";

const server = new McpServer({ name: "vynmm", version: "0.1.0" });

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

function loadWorkbook(path: string): Workbook {
  return readVmm(readFileSync(path)).workbook;
}

function save(path: string, wb: Workbook): void {
  writeFileSync(path, writeVmm(wb));
}

function findByText(wb: Workbook, needle: string): Topic | undefined {
  const lc = needle.toLowerCase();
  for (const sheet of wb.sheets) {
    for (const t of walkSheetTopics(sheet)) {
      if (t.title.toLowerCase().includes(lc)) return t;
    }
  }
  return undefined;
}

// --- tools -----------------------------------------------------------------

server.registerTool(
  "create_map",
  {
    title: "Create a mind map",
    description:
      "Create a new .vmm mind-map file. Provide a Markdown outline (# central topic, " +
      "## branches, nested - lists) or just a title for an empty map.",
    inputSchema: {
      path: z.string().describe("Destination file path, e.g. ./plan.vmm"),
      markdown: z.string().optional().describe("Markdown outline of the map"),
      title: z.string().optional().describe("Title if no markdown is given"),
    },
  },
  async ({ path, markdown, title }) => {
    const wb = markdown ? markdownToWorkbook(markdown) : createWorkbook(title ?? "Central Topic");
    save(path, wb);
    const topics = wb.sheets.reduce((n, s) => n + [...walkSheetTopics(s)].length, 0);
    return text(`Created ${path} with ${wb.sheets.length} sheet(s) and ${topics} topic(s).`);
  },
);

server.registerTool(
  "read_map",
  {
    title: "Read a mind map",
    description: "Return the contents of a .vmm file as a Markdown outline.",
    inputSchema: { path: z.string().describe("Path to a .vmm file") },
  },
  async ({ path }) => text(workbookToMarkdown(loadWorkbook(path))),
);

server.registerTool(
  "update_map",
  {
    title: "Replace a mind map's content",
    description:
      "Overwrite a .vmm file's content from a full Markdown outline. Use read_map " +
      "first, edit the outline, then update_map with the result.",
    inputSchema: {
      path: z.string(),
      markdown: z.string().describe("The complete new Markdown outline"),
    },
  },
  async ({ path, markdown }) => {
    const wb = markdownToWorkbook(markdown);
    save(path, wb);
    return text(`Updated ${path}.`);
  },
);

server.registerTool(
  "add_topics",
  {
    title: "Add child topics",
    description:
      "Append one or more child topics under the first existing topic whose text " +
      "contains `parentText`.",
    inputSchema: {
      path: z.string(),
      parentText: z.string().describe("Text identifying the parent topic"),
      items: z.array(z.string()).describe("Titles of the child topics to add"),
    },
  },
  async ({ path, parentText, items }) => {
    const wb = loadWorkbook(path);
    const parent = findByText(wb, parentText);
    if (!parent) return text(`No topic matching "${parentText}" was found.`);
    for (const item of items) addChild(parent, item);
    save(path, wb);
    return text(`Added ${items.length} topic(s) under "${parent.title}".`);
  },
);

server.registerTool(
  "map_info",
  {
    title: "Summarize a mind map",
    description: "Report the sheets, structures, and topic counts of a .vmm file.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    const { workbook, manifest } = readVmm(readFileSync(path));
    const lines = [`format ${manifest.formatVersion}, ${workbook.sheets.length} sheet(s):`];
    for (const s of workbook.sheets) {
      lines.push(`  - "${s.title}" [${s.structure}] — ${[...walkSheetTopics(s)].length} topics`);
    }
    return text(lines.join("\n"));
  },
);

await server.connect(new StdioServerTransport());
