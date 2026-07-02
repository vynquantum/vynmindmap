# VynMM

A cross-platform mind-mapping app (Windows / Linux / Mac) and an XMind-class
feature clone. Mind maps are stored locally as `.vmm` files. Humans edit them in a
visual canvas; LLMs read/write them through a Markdown lane and an MCP/CLI.

See [DESIGN.md](DESIGN.md) for the full design.

## Status

- **Milestone 1 — core model + file format** ✅
- **Milestone 2 — app shell + read-only render** ✅ (frontend done; native shell
  builds once Rust is installed)
- **Milestone 3 — interactive editing** ✅ (browser-testable)
- **Phase 2 — AI / LLM lane** ✅ (Markdown lane + CLI + MCP + skill)
- **Full-functional pass** ✅ (all structures, styles, markers, notes, links,
  relationships, an editing inspector, sheet management, undo/redo)

### Editor features

- **Structures**: balanced / left / right maps, logic & tree charts, vertical org
  charts, timelines; others render via a sensible horizontal fallback.
- **Rendering**: per-topic fill/border/shape/font, markers, note/link/image badges,
  labels, cross-topic **relationships** (curved arrows), **boundaries** (group
  outlines), **summaries** (braces + summary topic), and **floating topics**.
  Long titles **word-wrap** into multi-line nodes (explicit newlines supported —
  `Shift+Enter` while renaming); priority markers render as numbered chips.
- **Navigation**: zoom bar (bottom-left) with `Ctrl+=` / `Ctrl+-` / `Ctrl+0`
  shortcuts, a draggable minimap, auto-panning that keeps the keyboard selection
  in view, and **find** (`Ctrl+F`) — type to match topics, `Enter` / `Shift+Enter`
  cycles matches and centers them (expanding collapsed branches).
- **Clipboard**: `Ctrl+C` / `Ctrl+X` / `Ctrl+V` copy/cut/paste whole subtrees
  (fresh ids on paste; paste targets the selected topic, or lands as a floating
  topic), `Ctrl+D` duplicates in place. Works across sheets.
- **Context menu**: right-click a topic (add child/sibling, rename, relate,
  copy/cut/paste, duplicate, collapse, delete) or empty canvas (new floating
  topic, paste here, fit view).
- **Outline panel** (toolbar toggle): a synced tree sidebar — click to select
  and center, chevrons collapse/expand, double-click renames inline.
- **Detach / reattach**: drag a topic onto empty canvas to detach its subtree
  into a floating topic; drag a floating topic onto a node to attach it back.
- **Relationship editing**: double-click a relationship to edit its label;
  select it and drag the blue handle to reshape the curve (persisted in the
  file's `controlPoints`).
- **Autosave** (toolbar toggle): once the map has a file, changes save
  automatically ~1 s after you stop editing.
- **Recent files** on the welcome screen — native paths in the Tauri app,
  writable file handles (IndexedDB) in the browser.
- **Dark mode** (toolbar toggle) for the whole app chrome; the canvas keeps
  the sheet's own theme.
- **Safety**: native saves are atomic (temp file + rename — a crash can't
  corrupt the map); the Tauri app watches the open file and reloads it (or
  warns, if you have unsaved edits) when the CLI / an LLM edits it on disk.
- **Thumbnails**: every save embeds a PNG preview at
  `thumbnails/thumbnail.png` inside the `.vmm`.
- **Inspector** (right panel): edit text, shape, fill/border/text color, full
  **fonts** (family, size, **bold / italic / underline / strikethrough**),
  markers, an **emoji picker**, note, link, labels, the sheet's **structure**,
  and a **theme** (classic / dark / paper / mint / rose).
- **Images**: embedded topic images (from the `.vmm` `resources/`) render on nodes.
- **Floating topics**: double-click empty canvas to add one; drag to reposition.
- **Create connectors**: select a topic → **Relate →** then click a target to draw
  a relationship; **Ctrl-click** multiple contiguous siblings → **Add boundary** /
  **Add summary**. Click any relationship/boundary/summary and press `Delete`.
- **Export**: **Export PNG** / **Export PDF** rasterize the current sheet; Export MD
  for Markdown.
- **Drag**: drop on a node's middle to reparent, or near its top/bottom edge to
  reorder as a sibling (blue insertion line).
- **Sheets**: add (`+`), rename (double-click a tab), delete (`×`), switch.
- **Undo / redo**: `Ctrl+Z` / `Ctrl+Y` (and toolbar `↶ ↷`); `Ctrl+S` saves.
- **Markdown**: Import MD / Export MD in the toolbar.

### M3 — editing

Select a node, then:

| Action | Shortcut |
|--------|----------|
| Add child | `Tab` |
| Add sibling | `Enter` |
| Rename | `F2` or double-click |
| Delete | `Delete` / `Backspace` |
| Collapse / expand | `Space` or the `±` toggle |
| Navigate | arrow keys |
| Reparent | drag a node onto another |
| Save | **Save** button → downloads a `.vmm` (native Save arrives with the Tauri shell) |

A `●` dirty indicator and an unsaved-changes warning on close round it out.

### Phase 2 — AI / LLM lane

LLMs (and humans) author maps as **Markdown**, which converts to/from the canonical
`.vmm`. See [docs/vmm-markdown-format.md](docs/vmm-markdown-format.md).

| Surface | Where | Use |
|---------|-------|-----|
| Markdown lane | `src/markdown.ts` | `.vmm` ⇄ Markdown in code |
| CLI | `src/cli.ts` | `vynmm new / import / export / info` |
| MCP server | `mcp/server.ts` | tools: `create_map`, `read_map`, `update_map`, `add_topics`, `map_info` |
| Skill | `.claude/skills/vynmm-mindmap/` | teaches an LLM to author maps |
| App | Import MD / Export MD buttons | round-trip Markdown in the UI |

```bash
npm run vynmm -- new "My Map" -o my.vmm     # CLI
npm run vynmm -- import notes.md -o notes.vmm
npm run vynmm -- export my.vmm              # → Markdown on stdout
npm run mcp                                  # start the MCP server (stdio)
```

Register the MCP server in an MCP client with:
`{ "command": "npx", "args": ["tsx", "mcp/server.ts"], "cwd": "<repo>" }`

### M1 — core (`src/`)

The foundation: the data model, the `.vmm` reader/writer, and versioning — pure
logic, runs in Node and in the browser/Tauri webview unchanged.

| Module | Purpose |
|--------|---------|
| `src/types.ts`   | The `Workbook → Sheet → Topic` model (mirrors `content.json`) |
| `src/version.ts` | `formatVersion` parsing, gate, and migration registry |
| `src/model.ts`   | Factories, traversal, and mutations (add/move/delete/relate…) |
| `src/vmm.ts`     | `.vmm` (zip) read/write via `fflate` |

### M2 — app (`app/`, `src-tauri/`)

| Module | Purpose |
|--------|---------|
| `app/src/lib/layout.ts`        | `map.balanced` layout (pure geometry → boxes + edges) |
| `app/src/lib/MindMapView.svelte` | SVG renderer with pan / zoom |
| `app/src/App.svelte`           | Toolbar, sheet tabs, `.vmm` file loader |
| `src-tauri/`                   | Tauri v2 native shell (Rust) + icons + capabilities |

The web UI runs in a plain browser **and** inside the Tauri window — identical
code. There is **no server** in the product: the built UI is static files the
native webview loads from disk. Vite's dev server is a development-only tool.

## Run it

**Option A — one command (installs everything, then launches):**

```bash
# Linux / macOS
./scripts/setup.sh            # native app   (installs Rust + OS libs on first run)
./scripts/setup.sh --browser  # web preview  (no Rust needed)

# Windows (PowerShell)
.\scripts\setup.ps1            # native app
.\scripts\setup.ps1 -Browser   # web preview
```

**Option B — manual:**

```bash
npm install
npm run dev        # web preview at http://localhost:5183 (no Rust)
npm run app:dev    # native Tauri app (needs Rust toolchain)
npm run app:build  # package installers → src-tauri/target/release/bundle/
```

Once open, click an **example** button (rich / minimal / structures) or **Open
.vmm…** to load a file, then scroll to zoom and drag to pan.

## The `.vmm` file

A `.vmm` is a ZIP archive (like `.xmind`/`.docx`):

```
mymap.vmm
├── manifest.json    # { format, formatVersion, app, timestamps }
├── content.json     # the workbook: sheets, topics, relationships, …
└── resources/       # embedded images / attachments
```

## Develop

```bash
npm install
npm test            # vitest — round-trip, version, and model tests
npm run typecheck   # tsc --noEmit
npm run examples    # regenerate examples/*.vmm
```

## Example

```ts
import { createWorkbook, addChild, writeVmm, readVmm } from "vynmm-core";

const wb = createWorkbook("My Map");
addChild(wb.sheets[0].rootTopic, "First idea");

const bytes = writeVmm(wb);        // → .vmm file bytes (write to disk)
const { workbook } = readVmm(bytes); // ← parse a .vmm back into the model
```

## Next

- **Native shell** — install Rust, then `npm run app:dev` for the desktop window
  + native Open/Save dialogs
- **M4** — XMind breadth (more structures, styles, markers, relationships, …)
- **Phase 2** — Markdown lane + MCP/CLI for LLMs

## License

[MIT](LICENSE) © VynQuantum
