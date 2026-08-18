# Mind Map Preferences & Authoring Guidelines

This document defines the standard design preferences, styling guidelines, and structural patterns for authoring mind maps (`.vmm` / `.md`) in this repository.

---

## 1. Structure & Layout
- **Mind Map Type**: **Text on the lines** (`structure: map.right`).
- **Sheet Settings**:
  ```yaml
  settings: {"wrapText":false,"compactMap":false,"mapPresentation":"underline"}
  ```
  - `wrapText: false`: Sizes topic width dynamically to fit text length without forced text wrapping.
  - `compactMap: false`: Maintains full spacing between topics for presentation readability.
  - `mapPresentation: "underline"`: Renders topic text resting directly on top of branch lines.
- **Conciseness**: Keep node text concise and single-line for optimal canvas rendering and readability.

---

## 2. Themes
- **Supported Themes**: Use `ocean` or `classic` (configured in frontmatter as `theme: ocean` or `theme: classic`).

---

## 3. Folding & Progressive Reveal

A map that is presented is a **reveal instrument**, not a wall of text. The rule the whole structure serves: **the audience never sees a point before it is taught.** Two patterns do the work, and a presentation map uses both.

- **Folded by Default**: **ALL parent branches, main topics, and sub-nodes MUST be folded/collapsed by default** (`collapsed: true`). When the mind map opens, only the central root topic is expanded, keeping all sub-trees hidden initially.

### 3.1 The emoji layer — hides the *branches*

- **Rationale**: When a parent branch (e.g., Topic X) is expanded, all of its child points would naturally be visible at the same time. To conceal the individual points and allow step-by-step presentation, an intermediate layer of **bare, expressive EMOJI nodes** (e.g., `## 🌟`, `## ⚡`, `- 💧`, `- ⚛️`) is inserted as parent nodes instead of numbers or bullet points.
- **Behaviour**:
  - Main topic branches (e.g. `## 🚀 Topic X`) are set to `collapsed: true`.
  - Expanding Topic X reveals **only** the emoji parent nodes (which are also `collapsed: true`) — a row of symbols that carries no readable content.
  - The presenter opens each emoji node one by one to reveal the section underneath.

### 3.2 The chain — hides the *points* (required for presentation maps)

The emoji layer alone is not enough. Once a section node is opened, its points are **siblings**, so all of them appear at once and the room reads to the end of the section while the presenter is still on the first line. The reveal is dead.

So inside a section, **points are chained, not listed**: each point is the *child* of the point before it, every one `collapsed: true`.

```markdown
- 1️⃣ <!-- vmm: {"collapsed":true} -->
  - The sentence you did not choose <!-- vmm: {"collapsed":true,"note":"…"} -->
    - Something ordinary went wrong recently <!-- vmm: {"collapsed":true} -->
      - ✋ Say it out loud. Now. <!-- vmm: {"collapsed":true,"note":"…"} -->
        - Did you choose that sentence? <!-- vmm: {"collapsed":true,"note":"…"} -->
          - 💡 Old — my life is decided by what happens to me
```

- **Opening a point reveals exactly one new line** — never the list. The last point in a chain carries no `collapsed` flag; it has nothing left to open.
- **The order of the chain is the order of delivery.** Below the emoji layer a presentation map is a script, so nesting encodes *what comes next*, not taxonomy. Sibling grouping is deliberately given up to buy the reveal.
- **Collapsing the section node folds the whole staircase in one click.**
- **Cost, accepted on purpose**: a chain of *n* points is *n* levels deep, so long sections drift right across the canvas (`map.right`). Presenter mode zooms to each topic, so this is a panning cost, not a legibility one. Keep sections to roughly 6–12 points; a section that runs much longer is usually two sections.
- **When to skip the chain**: reference material the presenter reads privately and never projects (setup checklists, driving instructions, glossaries) stays a flat sibling list — chaining it only makes it slower to read.

---

## 4. Child Node Content Structure
Under each collapsed emoji parent node:
- **Topic Title & Content**: Place the actual topic title as the single child of the emoji node, then chain the section's points beneath it (§3.2).
- **Presenter Notes**: Everything the presenter needs and the audience must not see — exact wording, tempo, timings, warnings — goes in the node's `note` (`<!-- vmm: {"note":"…"} -->`), never in visible node text. A note is invisible to the room, so it is the safe layer.
- **Metadata is inline**: the `<!-- vmm: … -->` comment must sit **on the node's own line**. On a line of its own it is parsed as a paragraph and becomes literal note text.

---

## 5. VynMM Markdown Format Example

```markdown
---
title: System Architecture Overview
structure: map.right
theme: ocean
settings: {"wrapText":false,"compactMap":false,"mapPresentation":"underline"}
---

# System Architecture

## 🚀 Topic X: Core Services <!-- vmm: {"collapsed":true} -->

- ⚛️ <!-- vmm: {"collapsed":true} -->
  - Authentication Service <!-- vmm: {"collapsed":true,"note":"Presenter note: lead with the token lifetime question."} -->
    - OAuth2 & JWT session management <!-- vmm: {"collapsed":true} -->
      - Rate limiting per API key

- ⚡ <!-- vmm: {"collapsed":true} -->
  - Database Layer <!-- vmm: {"collapsed":true} -->
    - PostgreSQL primary cluster <!-- vmm: {"collapsed":true} -->
      - Redis read-through caching

- 💧 <!-- vmm: {"collapsed":true} -->
  - Message Queue <!-- vmm: {"collapsed":true} -->
    - Kafka event streaming <!-- vmm: {"collapsed":true} -->
      - Asynchronous job processing

## 🛡️ Topic Y: Security & Infrastructure <!-- vmm: {"collapsed":true} -->

- 🔑 <!-- vmm: {"collapsed":true} -->
  - Identity Access Management <!-- vmm: {"collapsed":true} -->
    - Role-based access control (RBAC)
```

Read the indentation as the reveal order: the emoji nodes appear together, and every point after that is opened one at a time.

---

*Note: All mind maps created in this repository should adhere to these preferences unless specifically overridden.*
