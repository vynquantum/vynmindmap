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

### 3.2 The placeholder layer — hides the *points* (required for presentation maps)

The emoji layer alone is not enough. Once a section node is opened, its points are **siblings**, so all
of them appear at once and the room reads to the end of the section while the presenter is still on the
first line. The reveal is dead.

So inside a section, **every point sits behind its own placeholder node** — a plain number (or a bare
emoji), `collapsed: true`, with the point itself as its only child.

```markdown
- 1️⃣ <!-- vmm: {"collapsed":true} -->
  - The sentence you did not choose <!-- vmm: {"collapsed":true,"note":"…"} -->
    - 1 <!-- vmm: {"collapsed":true} -->
      - Something ordinary went wrong recently
    - 2 <!-- vmm: {"collapsed":true} -->
      - ✋ Say it out loud. Now. <!-- vmm: {"note":"…"} -->
    - 3 <!-- vmm: {"collapsed":true} -->
      - Did you choose that sentence? <!-- vmm: {"note":"…"} -->
```

- **Opening a section reveals a row of placeholders and nothing readable.** The audience can count what
  is coming; they cannot read a word of it. The presenter opens one, teaches it, closes it, opens the
  next.
- **Prefer numbers to emoji below the section level.** They restart at 1 in each section, so they double
  as the presenter's position — *4 of 9* says how much section is left. Reserve the expressive emoji for
  the branch layer (§3.1), where each one stands for a different kind of content.
- **Do not chain the points instead** (point 1 holding point 2 holding point 3). It reveals one line at a
  time, which sounds better, but each section becomes as deep as it is long — a fourteen-point section is
  fourteen levels deep and marches off the right of the canvas, and the presenter cannot see where they
  are in it. The placeholder layer keeps the section flat and readable while hiding exactly as much.
- **When to skip placeholders**: reference material the presenter reads privately and never projects
  (setup checklists, driving instructions, glossaries) stays a flat sibling list — hiding it only makes
  it slower to read.

---

## 4. Child Node Content Structure
Under each collapsed emoji parent node:
- **Topic Title & Content**: Place the actual topic title as the single child of the emoji node, then one numbered placeholder per point beneath it (§3.2).
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
    - 1 <!-- vmm: {"collapsed":true} -->
      - OAuth2 & JWT session management
    - 2 <!-- vmm: {"collapsed":true} -->
      - Rate limiting per API key

- ⚡ <!-- vmm: {"collapsed":true} -->
  - Database Layer <!-- vmm: {"collapsed":true} -->
    - 1 <!-- vmm: {"collapsed":true} -->
      - PostgreSQL primary cluster
    - 2 <!-- vmm: {"collapsed":true} -->
      - Redis read-through caching

## 🛡️ Topic Y: Security & Infrastructure <!-- vmm: {"collapsed":true} -->

- 🔑 <!-- vmm: {"collapsed":true} -->
  - Identity Access Management <!-- vmm: {"collapsed":true} -->
    - 1 <!-- vmm: {"collapsed":true} -->
      - Role-based access control (RBAC)
```

Read it as three layers: the emoji nodes appear together, the numbers under a section appear together, and only the line inside a number is readable — one at a time.

---

*Note: All mind maps created in this repository should adhere to these preferences unless specifically overridden.*
