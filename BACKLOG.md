# Backlog

Open work on the Map tab, in rough priority order.

## 1. Fishbone drops everything below depth 3

`fishbone()` in `app/src/lib/layout.ts` iterates exactly two levels — cause
categories, then causes — so a third level ("API", "Database" in
`examples/rich.vmm`) is placed nowhere and silently disappears.

Real Ishikawa diagrams do have sub-causes, so this is a genuine gap, but there
is no existing pattern in the codebase to copy for sub-bone geometry. Needs a
design decision on how sub-bones attach before it can be implemented.

Every other chart type now places 100% of the topics; fishbone is the only
remaining exception.

## 2. Timeline chart types render as something else

`timeline.v` is literally `vertical(sheet, 'down')` — byte-identical output to
`org.down` (`app/src/lib/layout.ts`, the `layoutSheet` dispatch). `timeline.h`
falls through to the default branch and renders as a logic chart.

So two gallery cards promise a timeline and draw a chart already available under
another name: no axis, no date ordering, no milestone markers. Either give them
real timeline geometry, or drop the cards so the gallery stops overpromising.

## 3. Pitch mode (generated slide deck) — decided against

The feature would turn a map into a slide deck: topic slides and list slides,
several list layouts, decorative themes, aspect ratios, delivery animations,
PPT/video export. The Inspector had a "Pitch" tab stubbed out for it.

We present the **map** instead — `togglePresenterMode` in `app/src/App.svelte`
walks the tree with the map on screen. For a mind-mapping tool that's the better
default: the structure is the argument, and a deck throws it away. A deck builder
is also the largest piece of work left in the app, most of it visual design
rather than engineering.

So the tab is removed rather than left promising something that isn't coming.
Reopen this only if someone needs a **handout** (PDF/PNG export covers most of
that) or the ability to **hide branches** from a presentation — those are the
two things the walkthrough genuinely can't do.

## 4. Fit-to-screen never zooms in — no longer reproduces

`fit()` scales by `Math.min(vw / layout.width, vh / layout.height, 1.5)`, so it
does enlarge a small map, up to a 150% ceiling. Measured on the 3-topic "Team"
sheet of `examples/rich.vmm`: zoomed out to 60%, then `⛶` → 150%. On the
13-topic "Plan" sheet it settles at 85% from either direction. Both the `⛶`
button and the canvas menu's "Fit map to view" call the same `fitView`.

Closing this unless someone can name a map where it still sits tiny.
