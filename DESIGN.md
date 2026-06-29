# VynMM — Design Document

A cross-platform mind-mapping app and an XMind-class feature clone.
The mind map lives in a local **`.vmm`** file. Humans edit it in a visual canvas;
LLMs read/write it through a Markdown lane and an MCP/CLI. The structured file is
the single source of truth.

---

## 1. Guiding principles

1. **One canonical file, structured.** `.vmm` is a versioned ZIP container holding
   structured JSON. It can represent *everything* XMind can: multiple structures,
   floating topics, relationships, boundaries, summaries, styles, attachments.
2. **One core model.** The GUI and the AI tooling both load → mutate → save the
   same in-memory workbook. No second source of truth.
3. **LLM access via projection, not the raw file.** LLMs work through a Markdown
   import/export lane and an MCP/CLI over the model — they never have to parse the
   zip. Markdown round-trips the tree; rich features layer on in-app.
4. **Forward/backward compatible.** Every file carries a `formatVersion`. Parsing is
   lenient and preserves unknown fields; breaking changes ship with migrators.

---

## 2. Tech stack (decided)

| Layer        | Choice                                               |
|--------------|------------------------------------------------------|
| Shell        | **Tauri** (Rust core + web UI), Win/Linux/Mac         |
| UI           | Web frontend, SVG canvas rendering                    |
| File I/O     | Rust side: zip read/write, native dialogs, file watch |
| Format       | **`.vmm`** = versioned ZIP container (see §4)          |
| AI interface | MCP server + CLI + Markdown lane — *phase 2*           |

---

## 3. Architecture

```
            ┌──────────────────────────────────────┐
            │  UI (web/SVG): canvas, multiple        │
            │  structures, styles, panels            │
            └───────────────┬──────────────────────┘
                            │  commands (add/edit/move/style/relate…)
            ┌───────────────▼──────────────────────┐
            │  Core model: Workbook                  │
            │  (sheets → topics, floats, rels,       │
            │   boundaries, summaries, styles)       │
            └───┬──────────────┬─────────────┬───────┘
        load/   │              │ md project. │ MCP/CLI ops
        save    │              │             │
        ┌───────▼──────┐  ┌────▼─────┐  ┌────▼─────────┐
        │  .vmm (zip)  │  │ .md      │  │ AI interface │  (phase 2)
        │  JSON+assets │  │ in/out   │  │ MCP / CLI     │
        └──────────────┘  └──────────┘  └──────────────┘
```

---

## 4. File format: `.vmm`

### 4.1 Container

`.vmm` is a **ZIP archive** (same idea as `.xmind` and `.docx`):

```
mymap.vmm
├── manifest.json        # version + metadata (always read first)
├── content.json         # the workbook: sheets, topics, everything
├── resources/           # embedded images, attachments, audio
│   ├── img-a1.png
│   └── doc-b2.pdf
└── thumbnails/
    └── thumbnail.png    # preview for file managers / recent-files
```

### 4.2 `manifest.json`

```json
{
  "format": "vmm",
  "formatVersion": "1.0",
  "app": "VynMM",
  "appVersion": "0.1.0",
  "created": "2026-06-27T00:00:00Z",
  "modified": "2026-06-27T00:00:00Z"
}
```

### 4.3 `content.json` schema (v1.0)

```jsonc
{
  "id": "wb-uuid",
  "sheets": [
    {
      "id": "sheet-uuid",
      "title": "Sheet 1",
      "structure": "map.balanced",   // see §5 structure ids
      "theme": "classic",
      "background": { "color": "#fff", "image": null },
      "settings": { "rainbowBranches": true },

      "rootTopic": { /* Topic, see below */ },

      "floatingTopics": [ /* Topic[] with explicit position */ ],
      "relationships":  [ /* Relationship[] */ ],
      "boundaries":     [ /* Boundary[] */ ],
      "summaries":      [ /* Summary[] */ ]
    }
  ]
}
```

**Topic**
```jsonc
{
  "id": "t-uuid",
  "title": "Topic text",            // inline markdown allowed
  "structureClass": null,           // optional per-subtree layout override
  "collapsed": false,
  "position": null,                 // {x,y} for floating/manual; else auto

  "children": [ /* Topic[] (ordered) */ ],
  "callouts": [ /* Topic[] attached as callouts */ ],

  "style": {
    "shape": "rounded",             // rounded|rect|ellipse|underline|none…
    "fillColor": "#3aa",
    "borderColor": "#288",
    "borderWidth": 1,
    "lineColor": "#288",            // branch line to children
    "lineWidth": 2,
    "lineTaper": true,
    "font": { "family":"Inter","size":14,"weight":"normal",
              "style":"normal","color":"#111","decoration":"none" }
  },

  "markers": ["priority-1", "flag-red", "task-25%"],
  "labels":  ["needs review"],
  "note":    { "plain": "long note text", "rich": null },
  "hyperlink": { "type": "web", "value": "https://…" }, // web|file|topic|email
  "image":   { "resource":"resources/img-a1.png","width":160,"height":90 },
  "attachments": [ { "resource":"resources/doc-b2.pdf","name":"spec.pdf" } ]
}
```

**Relationship** (cross-link between any two topics)
```jsonc
{ "id":"r-uuid","end1Id":"t-1","end2Id":"t-2","title":"causes",
  "style":{"lineColor":"#888","lineWidth":2,"lineShape":"curved","arrow":"end"},
  "controlPoints": null }
```

**Boundary** (outline around a range of siblings)
```jsonc
{ "id":"b-uuid","parentId":"t-1","childIds":["t-2","t-3"],
  "title":"Phase 1","shape":"rounded","style":{ "fillColor":"#eef","borderColor":"#88a" } }
```

**Summary** (bracket summarizing a range → produces a summary topic)
```jsonc
{ "id":"s-uuid","parentId":"t-1","childIds":["t-2","t-3"],
  "shape":"curly","summaryTopic": { /* Topic */ } }
```

### 4.4 Markdown lane (LLM / text export)

A `.vmm` can be exported to / imported from Markdown. Markdown captures the topic
tree + markers/notes/links where expressible; floating topics, relationships,
boundaries, summaries, styles, and structure type are **not** representable and are
either dropped on export or added in-app after import.

```markdown
# Central Topic
## Main Topic A
- subtopic   <!-- vmm: {marker:"priority-1"} -->
## Main Topic B
```

---

## 5. XMind feature inventory (parity target)

### 5.1 Structures (per sheet) — `structure` ids
- `map.balanced`, `map.left`, `map.right` — classic mind map
- `logic.right`, `logic.left` — logic chart
- `org.down`, `org.up` — org chart
- `tree.right`, `tree.left` — tree / right-logic hybrid
- `timeline.h`, `timeline.v` — timeline
- `fishbone.right`, `fishbone.left` — fishbone / Ishikawa
- `matrix` — matrix / spreadsheet-like
- `tree-table` — tree table
- `brace.right`, `brace.left` — brace map

### 5.2 Topic elements
Central topic · main topics · subtopics · **floating topics** · **callouts** ·
collapse/expand · multi-line text · topic images.

### 5.3 Connectors & groupings
**Relationships** (curved cross-links + label) · **Boundaries** · **Summaries**.

### 5.4 Decorations
**Markers/icons** (priority, task progress, flags, stars, smileys, people, arrows,
symbols, months/weeks) · **labels** · **notes** (rich text) · **hyperlinks**
(web/file/topic/email) · **attachments** (images, files, audio) · stickers.

### 5.5 Styling & themes
Themes · per-topic shape/fill/border · branch line color/width/taper ·
fonts (family/size/weight/style/color/decoration) · **rainbow branches** ·
sheet background color/image.

### 5.6 Workbook & app features
Multiple **sheets** per file · drilldown/focus mode · outline view ·
zen mode · presentation/pitch mode · brainstorming mode ·
export (PNG, PDF, Markdown, OPML, …) · optional password/encryption.

---

## 6. Core model (in memory)

`Workbook → Sheet[] → (rootTopic: Topic tree) + floatingTopics + relationships +
boundaries + summaries`. Mirrors §4.3. Stable ids assigned on load if missing.

Operations the GUI and AI both call:
`addChild` · `addSibling` · `addFloating` · `editText` · `move (reparent/reorder)` ·
`delete` · `toggleCollapse` · `setStyle` · `addMarker/Label/Note/Link/Image` ·
`addRelationship` · `addBoundary` · `addSummary` · `setStructure` · `addSheet`.

---

## 7. Versioning strategy

- `formatVersion` is `MAJOR.MINOR`.
- **MINOR bump** = additive / backward-compatible (new optional fields). Older apps
  open newer-minor files and **preserve unknown fields** on round-trip.
- **MAJOR bump** = breaking. The app ships a **migration registry**
  (`migrate_1_x_to_2_0`, …) run on load to upgrade old files in memory.
- On open: read `manifest.json` → if `formatVersion` newer-major than supported,
  warn (read-only/limited); if older, migrate; if newer-minor, load leniently.
- Always write the current `formatVersion`; keep a fixture file per released version
  for round-trip/migration tests.

---

## 8. UI / UX

- **SVG canvas**: render the active sheet's structure; pan/zoom; minimap later.
- **Keyboard-first** editing: `Tab` child · `Enter` sibling · `Delete` · arrows to
  navigate · `Space` collapse/expand · `F2`/double-click edit.
- **Drag** to reparent/reorder; drag endpoints to draw relationships.
- **Panels**: style inspector, notes, outline, markers palette.
- **Tabs** for sheets. Native New/Open/Save/Save-As/Export via Tauri.
- Explicit **Save** + dirty indicator (autosave later).

---

## 9. AI interface (phase 2 — designed now)

All three produce/consume the same model, never the raw zip:
1. **MCP server** (bundled): `create_map`, `read_map`, `add_topic`, `edit_topic`,
   `add_relationship`, `set_structure`, … operating on `.vmm` files.
2. **CLI** (`vynmm`): scriptable; `vynmm import plan.md -o plan.vmm`, `vynmm export`.
3. **Markdown skill**: teaches an LLM the §4.4 Markdown lane so it can draft a map
   with zero tooling; the app imports it.

---

## 10. Roadmap (lean core first, then breadth)

**M1 — Format + core model (no UI)**
- [ ] Lock `manifest.json` + `content.json` v1.0 schema; write example `.vmm` files
- [ ] Reader/writer: zip ↔ Workbook model (round-trips cleanly)
- [ ] Version check + migration scaffold + tests

**M2 — App shell + read-only render**
- [ ] Tauri scaffold builds on Win/Linux/Mac
- [ ] Open/Save `.vmm` via native dialogs
- [ ] Render `map.balanced` on SVG canvas (read-only)

**M3 — Core editing (one structure)**
- [ ] Select / add child / sibling / edit / delete / collapse
- [ ] Drag reparent/reorder · explicit save + dirty state
- [ ] Zoom / pan / keyboard shortcuts

**M4 — XMind breadth (iterative, feature by feature)**
- [ ] More structures: logic, org, tree, timeline, fishbone, brace, matrix, tree-table
- [ ] Relationships · boundaries · summaries · floating topics · callouts
- [ ] Styles & themes · rainbow branches · markers · labels · notes · links · images
- [ ] Multiple sheets · outline view · export (PNG/PDF/MD/OPML)

**Phase 2 — AI**
- [ ] Markdown import/export lane
- [ ] MCP server + CLI over the model
- [ ] Markdown-format skill doc

---

## 11. Open questions

- Web framework for the UI: **Svelte** (recommended, light) vs React?
- Layout engine: hand-rolled per-structure vs a graph layout lib (e.g. ELK/d3) —
  fishbone/matrix/brace need custom layout regardless.
- Theme system: ship a few built-in themes first; user-defined themes later.
- Encryption: AES on the zip if password set — defer to post-M4.
```

