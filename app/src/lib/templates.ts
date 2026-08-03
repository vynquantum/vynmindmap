/**
 * Starter maps for the welcome screen.
 *
 * A blank canvas is the hardest way to start a map, so the common shapes ship
 * with the app. They are written as Markdown — the same lane the CLI and the AI
 * tools use — so adding one is editing a string, not building topics by hand.
 */

import { markdownToWorkbook, type Workbook } from '../../../src/index.js';

export interface Template {
  id: string;
  title: string;
  /** One line under the title on the welcome card. */
  note: string;
  markdown: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'meeting',
    title: 'Meeting notes',
    note: 'agenda · decisions · actions',
    markdown: `---
title: Meeting notes
structure: map.balanced
---

# Meeting notes

## Attendees

- Someone
- Someone else

## Agenda

- First item
- Second item

## Decisions

- What we agreed

## Action items

- Who does what, by when

## Parking lot

- Raised, not settled
`
  },
  {
    id: 'project',
    title: 'Project plan',
    note: 'goals · scope · milestones · risks',
    markdown: `---
title: Project plan
structure: map.balanced
---

# Project plan

## Goal

The one sentence this project is for.

## Scope

- In scope
- Out of scope

## Milestones

- M1 — first usable version
- M2 — feature complete
- M3 — shipped

## Risks

- What could go wrong, and the answer to it

## Team

- Who owns which part
`
  },
  {
    id: 'retro',
    title: 'Retrospective',
    note: 'went well · to fix · actions',
    markdown: `---
title: Retrospective
structure: map.balanced
---

# Retrospective

## What went well

- Keep doing this

## What didn't

- The honest one

## Ideas

- Worth trying next time

## Actions

- One owner each, or it doesn't happen
`
  },
  {
    id: 'decision',
    title: 'Decision',
    note: 'options weighed against criteria',
    markdown: `---
title: Decision
structure: org.down
---

# The decision to make

## Criteria

- What actually matters here

## Option A

- Pro
- Con

## Option B

- Pro
- Con

## Chosen

Why this one, so the reasoning survives the meeting.
`
  },
  {
    id: 'swot',
    title: 'SWOT',
    note: 'strengths · weaknesses · opportunities · threats',
    markdown: `---
title: SWOT
structure: map.balanced
---

# SWOT

## Strengths

- Ours, today

## Weaknesses

- Ours, today

## Opportunities

- Outside, ahead

## Threats

- Outside, ahead
`
  },
  {
    id: 'study',
    title: 'Study notes',
    note: 'concepts · definitions · questions',
    markdown: `---
title: Study notes
structure: tree.right
---

# Subject

## Key concepts

- Concept
  - What it means
  - Why it matters

## Definitions

- Term — meaning

## Examples

- Worked example

## Open questions

- Ask about this
`
  }
];

/** Build a fresh workbook from a template id, or null if there is no such id. */
export function templateWorkbook(id: string): Workbook | null {
  const t = TEMPLATES.find((t) => t.id === id);
  return t ? markdownToWorkbook(t.markdown) : null;
}
