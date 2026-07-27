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

## 3. Fit-to-screen never zooms in — no longer reproduces

`fit()` scales by `Math.min(vw / layout.width, vh / layout.height, 1.5)`, so it
does enlarge a small map, up to a 150% ceiling. Measured on the 3-topic "Team"
sheet of `examples/rich.vmm`: zoomed out to 60%, then `⛶` → 150%. On the
13-topic "Plan" sheet it settles at 85% from either direction. Both the `⛶`
button and the canvas menu's "Fit map to view" call the same `fitView`.

Closing this unless someone can name a map where it still sits tiny.
