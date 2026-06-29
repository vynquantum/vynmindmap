import { describe, it, expect, afterAll } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { readVmm } from "../src/index.js";

/**
 * Spawns the MCP server (over stdio) and speaks raw JSON-RPC to it, the same way
 * a real MCP client would. Verifies the handshake, tool listing, and that
 * create_map / read_map actually produce and read a .vmm file.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "vynmm-mcp-"));

let proc: ChildProcessWithoutNullStreams;

function startServer() {
  proc = spawn("npx", ["tsx", "mcp/server.ts"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
}

/** Minimal newline-delimited JSON-RPC client over the child's stdio. */
function rpc(method: string, params: unknown, id: number): Promise<any> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            proc.stdout.off("data", onData);
            resolve(msg);
          }
        } catch {
          /* partial / non-JSON line, keep buffering */
        }
      }
    };
    proc.stdout.on("data", onData);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 20000);
  });
}

function notify(method: string, params: unknown) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

afterAll(() => {
  proc?.kill();
  rmSync(tmp, { recursive: true, force: true });
});

describe("MCP server", () => {
  it("handshakes, lists tools, and creates + reads a map", async () => {
    startServer();

    const init = await rpc(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
      1,
    );
    expect(init.result.serverInfo.name).toBe("vynmm");
    notify("notifications/initialized", {});

    const tools = await rpc("tools/list", {}, 2);
    const names = tools.result.tools.map((t: any) => t.name).sort();
    expect(names).toEqual(["add_topics", "create_map", "map_info", "read_map", "update_map"]);

    const file = join(tmp, "mcp.vmm");
    const created = await rpc(
      "tools/call",
      { name: "create_map", arguments: { path: file, markdown: "# Root\n## A\n- a1\n## B\n" } },
      3,
    );
    expect(created.result.content[0].text).toMatch(/Created/);

    // The file is a real, readable .vmm.
    const { workbook } = readVmm(readFileSync(file));
    expect(workbook.sheets[0]!.rootTopic.title).toBe("Root");

    const read = await rpc("tools/call", { name: "read_map", arguments: { path: file } }, 4);
    expect(read.result.content[0].text).toContain("## A");
    expect(read.result.content[0].text).toContain("## B");
  }, 30000);
});
