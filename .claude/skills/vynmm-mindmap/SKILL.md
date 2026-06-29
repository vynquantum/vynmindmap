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
   - Optional frontmatter to pick a layout:
     `structure: org.down` (or `logic.right`, `fishbone.right`, `timeline.h`, …).
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

## Full format reference

See [docs/vmm-markdown-format.md](../../../docs/vmm-markdown-format.md) for the
complete spec (all structures, multi-sheet files, every metadata key).

## When an MCP client is available

If the VynMM MCP server is connected, prefer its tools instead of the CLI:
`create_map`, `read_map`, `update_map`, `add_topics`, `map_info` — all take/return
the same Markdown.
