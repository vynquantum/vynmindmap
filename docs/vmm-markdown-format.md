# Authoring VynMM mind maps as Markdown

VynMM's canonical file is a `.vmm` (a zip of structured JSON). But you rarely need
to write that directly: VynMM has a **Markdown lane** — a plain-text projection of
the map that humans and LLMs can read and write. Tools convert your Markdown into a
`.vmm` and back.

This page is the complete spec for that Markdown.

## Structure

```markdown
---
title: Project Plan
structure: map.balanced
theme: classic
---

# Project Plan

## Research

- Competitors
  - Tool A
  - Tool B
- User interviews

## Build

- Frontend
- Backend
  - API
  - Database
```

Rules:

1. **Frontmatter** (optional) sets the sheet's `title`, `structure`, and `theme`.
2. **`# H1`** is the single **central topic** (the root).
3. **`## H2`** lines are the **level-1 branches**.
4. **`-` list items** under a branch are its children; nested lists nest deeper.
5. Indent nested list items by **2 spaces** per level.
6. **Paragraphs**: Any regular unformatted text following a heading or list item will be appended to that topic's `note`.
7. The parser is lenient — it also accepts deeper headings (`###`…) or lists at any
   level, and tolerates `*` bullets.

## Structures

Set `structure:` in the frontmatter to one of:

`map.balanced`, `map.left`, `map.right`, `logic.right`, `logic.left`, `org.down`,
`org.up`, `tree.right`, `tree.left`, `timeline.h`, `timeline.v`, `fishbone.right`,
`fishbone.left`, `matrix`, `tree-table`, `grid`, `brace.right`, `brace.left`.

Anything else is ignored and the sheet falls back to `map.balanced`, so a typo
costs you the layout, not the import.

(Only the topic tree is shared across structures; the structure just changes how
VynMM lays it out.)

## Sheet settings

Everything on the Inspector's **Map** tab round-trips through the frontmatter,
as one line of JSON each:

```text
---
title: Project Plan
structure: map.balanced
theme: classic
settings: {"wrapText":false,"compactMap":true,"branchColor":"#1f4fd0"}
background: {"color":"#f7f7f7"}
---
```

Export writes them only when the sheet has any, and unknown keys survive the
trip — so a file written by a newer build keeps its settings when an older one
re-exports it. A value that isn't a JSON object is ignored rather than fatal,
like everything else here.

## Per-topic extras

Attach a trailing HTML comment to any heading or list item to add metadata:

```markdown
## Build <!-- vmm: {"markers":["priority-1"],"note":"Start Monday","collapsed":true} -->

Some additional notes can also just be typed as plain text below the heading!
It will be appended to the topic's note.

- API <!-- vmm: {"link":"https://api.example.com"} -->
```

Readable shorthands: `markers` (string[]), `labels` (string[]), `note` (string),
`collapsed` (boolean), `link` (string URL).

Everything else a topic carries is written verbatim under its own key, so export
loses nothing: `style`, `image`, `position`, `attachments`, `structureClass`, a
rich `note` object, a non-web `hyperlink`, and any key a newer build adds.

```markdown
## Build <!-- vmm: {"style":{"fillColor":"#1f4fd0","fontBold":true},"image":{"resource":"resources/logo.png","width":120}} -->
```

`id` is written only for topics a relationship, boundary, or summary points at —
ordinary outlines stay free of id noise. On import, ids you didn't supply are
generated; a duplicate id is replaced and connectors that end up pointing
nowhere are dropped, so a hand-edited file can't produce a broken map.

`title` and `children` in a comment are ignored: the outline is the tree.

## Relationships, boundaries and summaries

These live in the frontmatter, one line of JSON each, referencing topics by `id`:

```text
---
title: Project Plan
relationships: [{"id":"r1","end1Id":"t-a","end2Id":"t-b","title":"blocks"}]
boundaries: [{"id":"b1","parentId":"t-a","childIds":["t-a1","t-a2"],"title":"Phase 1"}]
summaries: [{"id":"s1","parentId":"t-a","childIds":["t-a1"],"topicId":"t-sum"}]
---
```

Export writes these itself, with matching `id`s on the topics involved — the
easiest way to get the shape right is to export a map that has them.

## Floating topics

A `<!-- vmm:floating -->` line ends the main tree; each `## H2` after it is a
floating topic (with its own list children and per-topic comment, usually
carrying a `position`).

```markdown
# Project Plan

## Research

<!-- vmm:floating -->

## Parking lot <!-- vmm: {"position":{"x":320,"y":-140}} -->

- Revisit pricing
```

## Multiple sheets

Separate sheets with a `<!-- vmm:sheet -->` line. Each section is a full document
(its own frontmatter + `# H1`).

## What doesn't survive

Only the **bytes** of embedded images and attachments: Markdown is text, so it
keeps the reference (`resources/logo.png`) but not the file. Import back over
the original `.vmm` and the pictures come back — `vynmm import edited.md -o
map.vmm` and the MCP tools keep the resources already in the file they rewrite.
Importing Markdown in the app opens it as a new map, so pick the `.vmm` route
when the map has images.

## Converting

**CLI:**

If you have the package installed globally, you can use `vynmm`. If you are working in the repository locally, you can use `npx tsx src/cli.ts` or `npm run vynmm`.

```bash
vynmm import plan.md -o plan.vmm         # Markdown → .vmm
vynmm import a.md b.md -o all.vmm        # several outlines, a tab each
vynmm export plan.vmm -o plan.md         # .vmm → Markdown
vynmm merge q1.vmm q2.vmm notes.md       # any mix → merged.vmm, a tab per sheet
vynmm new "My Map" -o my.vmm             # empty map
vynmm info plan.vmm                      # summary
```

**MCP** (for LLM clients): tools `create_map`, `read_map`, `update_map`,
`add_topics`, `merge_maps`, `map_info` — all speak this Markdown.

## Combining maps

`merge` (and multi-file `import`, and the app's **Merge** toolbar button) puts
every sheet of every input into one workbook as its own tab, in the order given.
Collisions are resolved rather than dropped: duplicate topic ids are renumbered
with their relationships, boundaries and summaries following them; resources
that share a path but differ in content are stored side by side
(`resources/logo-2.png`) and the topics repointed; duplicate tab names become
`Plan (2)`. Inputs are never modified.
