# Backlog

Open work on the Map tab, in rough priority order. Nothing here is started.

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

## 3. Fit-to-screen never zooms in

The `⛶` control centers the map but does not scale it up to fill the viewport,
so a small map sits tiny in the middle of a large canvas. Minor, but it is the
first thing you reach for after switching chart type.
