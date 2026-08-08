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

## 3. Folding & Emoji Progressive Reveal Layer
- **Folded by Default**: **ALL parent branches, main topics, and sub-nodes MUST be folded/collapsed by default** (`collapsed: true`). When the mind map opens, only the central root topic is expanded, keeping all sub-trees hidden initially.
- **Emoji Layer Rationale**: When a parent branch (e.g., Topic X) is expanded, all of its child points would naturally be visible at the same time. To conceal the individual points and allow step-by-step presentation, an intermediate layer of **expressive EMOJI nodes** (e.g., `## 🌟`, `## ⚡`, `- 💧`, `- ⚛️`) is inserted as parent nodes instead of numbers or bullet points.
- **Progressive Reveal Behavior**:
  - Main topic branches (e.g. `## 🚀 Topic X`) are set to `collapsed: true`.
  - Expanding Topic X reveals **only** the emoji parent nodes initially (which are also set to `collapsed: true`).
  - During a presentation or discussion, the user can open each emoji node one by one to reveal the actual topic content underneath.

---

## 4. Child Node Content Structure
Under each collapsed emoji parent node:
- **Topic Title & Content**: Place the actual topic title, description, and key points as child nodes under the emoji node.
- **Presenter Notes**: Additional details or presenter notes are attached as child bullets or text under the topic node.

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
  - Authentication Service
    - OAuth2 & JWT session management
    - Rate limiting per API key

- ⚡ <!-- vmm: {"collapsed":true} -->
  - Database Layer
    - PostgreSQL primary cluster
    - Redis read-through caching

- 💧 <!-- vmm: {"collapsed":true} -->
  - Message Queue
    - Kafka event streaming
    - Asynchronous job processing

## 🛡️ Topic Y: Security & Infrastructure <!-- vmm: {"collapsed":true} -->

- 🔑 <!-- vmm: {"collapsed":true} -->
  - Identity Access Management
    - Role-based access control (RBAC)
```

---

*Note: All mind maps created in this repository should adhere to these preferences unless specifically overridden.*
