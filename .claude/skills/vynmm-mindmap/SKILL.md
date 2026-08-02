---
name: vynmm-mindmap
description: >-
  Create or edit VynMM mind maps (.vmm files). Use when the user wants to make a
  mind map, brainstorm a topic into a map, outline something visually, or convert
  notes into a .vmm. Writes a Markdown outline and converts it with the vynmm CLI.
---

# Creating VynMM mind maps

A `.vmm` mind map is authored as a **Markdown outline** and converted to the `.vmm`
file. You never write the binary format by hand.

## Steps

1. Draft the map as Markdown:
   - `# Central topic` (exactly one).
   - `## Branch` for each main branch.
   - `-` list items (indent 2 spaces per level) for sub-topics.
   - Optional frontmatter for the layout, theme and map settings (below).
   - Optional per-topic metadata: `Task <!-- vmm: {"markers":["priority-1"]} -->`.

   ```markdown
   ---
   title: Launch Plan
   structure: map.balanced
   ---

   # Launch Plan

   ## Marketing

   - Landing page
   - Email campaign

   ## Engineering

   - API
   - Frontend
   ```

2. Save the Markdown to a temp file, then convert:

   ```bash
   vynmm import plan.md -o plan.vmm        # via the CLI
   # or, without a global install, from the repo:
   npm run vynmm -- import plan.md -o plan.vmm
   ```

3. To edit an existing map: `vynmm export map.vmm -o map.md`, change the Markdown,
   then `vynmm import map.md -o map.vmm`.

   The round-trip is lossless: styles, images, positions, relationships,
   boundaries, summaries and floating topics all come back. Only the **bytes**
   of embedded images can't live in text — importing back over the original
   `.vmm` (as above) keeps them, so pass the same file to `-o`.

4. To combine maps: `vynmm merge q1.vmm q2.vmm notes.md -o all.vmm` — every
   sheet of every input becomes its own tab, in the order given, `.vmm` and
   `.md` freely mixed. Colliding ids, resource paths and tab names are
   renamed rather than dropped; the inputs are left alone.

## Frontmatter

| Key             | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `title`         | Tab name. Defaults to the `# H1` (the central topic).                       |
| `structure`     | Layout id (below). A typo falls back to `map.balanced` instead of failing.  |
| `theme`         | `classic` (default), `ocean`, `forest`, `sunset`, `lavender`, `monochrome`. |
| `settings`      | One line of JSON — the Inspector's **Map** tab. See below.                  |
| `background`    | One line of JSON: `{"color":"#f7f7f7"}`.                                    |
| `relationships` | One line of JSON array; each `{"id","end1Id","end2Id","title"?}`.           |
| `boundaries`    | One line of JSON array; each `{"id","parentId","childIds":[…],"title"?}`.   |
| `summaries`     | Like `boundaries`, but carrying a whole `summaryTopic` object.              |

Structures: `map.balanced`, `map.left`, `map.right`, `map.underline`,
`logic.right`, `logic.left`,
`org.down`, `org.up`, `tree.right`, `tree.left`, `timeline.h`, `timeline.v`,
`fishbone.right`, `fishbone.left`, `matrix`, `tree-table`, `grid`, `brace.right`,
`brace.left`.

```text
---
title: Launch Plan
structure: map.balanced
theme: ocean
settings: {"wrapText":false,"compactMap":true,"branchColor":"#1f4fd0"}
background: {"color":"#f7f7f7"}
---
```

### `settings` keys

All optional; write only the ones you want to change. Unknown keys are kept
verbatim, so a file from a newer build doesn't lose settings on re-export. A
`settings:` value that isn't a JSON object is ignored rather than fatal.

| Key                       | Type                                                                   | Effect                                                                       |
| ------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `wrapText`                | boolean (default `true`)                                               | `false` keeps every title on one line and lets the topic grow wider.         |
| `compactMap`              | boolean                                                                | Tighten the gaps between topics and levels.                                  |
| `uniformTopicLength`      | boolean                                                                | Widen every topic to the widest one, so titles line up in columns.           |
| `displayAllNotes`         | boolean                                                                | Show each note under its title instead of only the 📝 badge.                 |
| `mapPresentation`         | `boxed` \| `underline`                                                 | Boxed topics, or bare text on an underline.                                  |
| `boxedLevelOne`           | boolean                                                                | With `underline`, keep the root and its branches boxed.                      |
| `defaultShape`            | `rounded` \| `rect` \| `ellipse` \| `underline` \| `capsule` \| `none` | Shape for topics without their own.                                          |
| `coloredBranches`         | boolean                                                                | Each top-level branch takes a color from the theme palette.                  |
| `rainbowBranches`         | boolean                                                                | Cycle branch colors across the whole palette.                                |
| `branchColor`             | color string                                                           | Single branch color, used when `coloredBranches` is off.                     |
| `branchLineWidth`         | number                                                                 | Default branch line width.                                                   |
| `branchStyle`             | `curve` \| `straight` \| `elbow`                                       | Connector geometry; each structure family has its own default.               |
| `globalFont`              | font family string                                                     | Default font for topics without their own.                                   |
| `autoColorFloating`       | boolean                                                                | Give floating topics a palette color instead of gray.                        |
| `flexibleFloatingTopic`   | boolean                                                                | Shift floating topics clear of the map instead of letting it grow over them. |
| `relationLineFollowTopic` | boolean                                                                | Draw relationship lines in their source topic's color.                       |
| `freeBranchPosition`      | boolean                                                                | Dragging a branch to empty canvas moves it there instead of detaching it.    |
| `topicOverlap`            | boolean (default `true`)                                               | `false` snaps a drop to the nearest free space.                              |

### Per-topic keys

In the trailing `<!-- vmm: {…} -->` comment on any heading or list item:
`markers` (string array), `labels` (string array), `note` (string),
`collapsed` (boolean), `link` (URL string).

```markdown
## Build <!-- vmm: {"markers":["priority-1"],"note":"Start Monday","collapsed":true} -->

- API <!-- vmm: {"link":"https://api.example.com"} -->
```

Export also writes `style`, `image`, `position`, `attachments` and any other
topic field verbatim into the same comment, plus `id` on topics that a
relationship, boundary or summary points at. Leave those alone unless you mean
to change them; ids you don't write are generated for you.

### Floating topics

A `<!-- vmm:floating -->` line ends the main tree — each `## H2` after it is a
floating topic, usually with a `position` in its comment.

## Full format reference

See [docs/vmm-markdown-format.md](../../../docs/vmm-markdown-format.md) for the
complete spec (all structures, multi-sheet files, every metadata key).

## When an MCP client is available

If the VynMM MCP server is connected, prefer its tools instead of the CLI:
`create_map`, `read_map`, `update_map`, `add_topics`, `merge_maps`, `map_info` —
all take/return the same Markdown.
