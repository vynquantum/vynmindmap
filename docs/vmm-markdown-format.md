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
6. The parser is lenient — it also accepts deeper headings (`###`…) or lists at any
   level, and tolerates `*` bullets.

## Structures

Set `structure:` in the frontmatter to one of:

`map.balanced`, `map.left`, `map.right`, `logic.right`, `logic.left`, `org.down`,
`org.up`, `tree.right`, `tree.left`, `timeline.h`, `timeline.v`, `fishbone.right`,
`fishbone.left`, `matrix`, `tree-table`, `brace.right`, `brace.left`.

(Only the topic tree is shared across structures; the structure just changes how
VynMM lays it out.)

## Per-topic extras

Attach a trailing HTML comment to any heading or list item to add metadata:

```markdown
## Build <!-- vmm: {"markers":["priority-1"],"note":"Start Monday","collapsed":true} -->
- API <!-- vmm: {"link":"https://api.example.com"} -->
```

Supported keys: `markers` (string[]), `labels` (string[]), `note` (string),
`collapsed` (boolean), `link` (string URL). Other VynMM features (styles,
relationships, boundaries, summaries, floating topics, images) are **not**
expressible in Markdown — add them in the app.

## Multiple sheets

Separate sheets with a `<!-- vmm:sheet -->` line. Each section is a full document
(its own frontmatter + `# H1`).

## Converting

**CLI:**

```bash
vynmm import plan.md -o plan.vmm    # Markdown → .vmm
vynmm export plan.vmm -o plan.md    # .vmm → Markdown
vynmm new "My Map" -o my.vmm        # empty map
vynmm info plan.vmm                 # summary
```

**MCP** (for LLM clients): tools `create_map`, `read_map`, `update_map`,
`add_topics`, `map_info` — all speak this Markdown.
