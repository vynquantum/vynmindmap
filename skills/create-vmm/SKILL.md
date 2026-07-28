---
name: create-vmm-mindmap
description: Instructs the agent on how to author and compile a VynMM (.vmm) mind map using Markdown and the CLI.
---

# Creating a VynMM Mind Map (.vmm)

When a user asks you to create, generate, or build a `.vmm` (VynMM) mind map file, you must follow this two-step process. A `.vmm` file is a zipped binary file containing JSON, so **you should never attempt to write the JSON or zip file manually**. Instead, you will write a specific Markdown format and use the built-in CLI to compile it.

## Step 1: Write the Mind Map in Markdown

VynMM has a specific Markdown format for representing mind maps. Create a temporary `.md` file using this format.

### Format Rules:

1. **Frontmatter**: (Optional) Use YAML frontmatter to set the `title`, `structure` (e.g. `map.balanced`, `org.down`, `tree.right`), and `theme`.
2. **Root Topic**: The single `# H1` heading in the file represents the central topic (root).
3. **Branches**: Use `## H2` headings for level-1 branches.
4. **Sub-topics**: Use `-` lists for deeper topics. Indent by 2 spaces for each nested level.
5. **Notes**: Any plain, unformatted text paragraphs beneath a heading or list item will automatically be added as a note for that topic.
6. **Metadata**: You can attach extra metadata to a topic by appending an HTML comment to the end of the heading or list item: `<!-- vmm: {"markers":["priority-1"],"collapsed":true} -->`

### Example Markdown:

```markdown
---
title: Project Launch Plan
structure: map.balanced
---

# Launch Plan

## Engineering
- API Deploy <!-- vmm: {"markers":["priority-1"]} -->
  - Verify endpoints
  - Database migration
- Frontend Deploy

## Marketing
Start the email campaign.

- Send newsletter
```

## Step 2: Compile the Markdown to `.vmm`

Once you have written the `.md` file, use the built-in VynMM CLI tool to convert it to a `.vmm` file.

Run the following command using your shell/terminal execution tool (if you are inside the `vynmindmap` repository):

```bash
npx tsx src/cli.ts import path/to/your_file.md -o path/to/output.vmm
```

*(Note: If the CLI is installed globally, you can just run `vynmm import path/to/your_file.md -o path/to/output.vmm`)*

After the command completes successfully, you can delete the temporary `.md` file and inform the user that the `.vmm` file has been created!
