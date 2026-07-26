# Backlog

Open work on the Map tab, in rough priority order. Nothing here is started.

## 1. Level-1 topics keep a filled box (appearance option)

In the reference maps, the branches directly under the root render as filled,
rounded, colored pills while everything deeper is bare text on a line. Right now
the text-on-lines treatment strips the box from every depth uniformly.

Add this as an option the user turns on, not as a hardcoded rule — it belongs
next to Text on Lines in the Map tab, in the same decoupled
appearance/`MapPresentation` family as the existing controls, so it composes
with any chart type rather than becoming a new chart type.

Also settle what floating topics do. They currently pick up whatever style
level-1 branches get, which happens to match the reference, but that is a
coincidence of the current code rather than a decision. Confirm it is intended
and make it explicit.

User will supply a concrete example image before this is built.

## 2. Fishbone drops everything below depth 3

`fishbone()` in `app/src/lib/layout.ts` iterates exactly two levels — cause
categories, then causes — so a third level ("API", "Database" in
`examples/rich.vmm`) is placed nowhere and silently disappears.

Real Ishikawa diagrams do have sub-causes, so this is a genuine gap, but there
is no existing pattern in the codebase to copy for sub-bone geometry. Needs a
design decision on how sub-bones attach before it can be implemented.

Every other chart type now places 100% of the topics; fishbone is the only
remaining exception.

## 3. Timeline chart types render as something else

`timeline.v` is literally `vertical(sheet, 'down')` — byte-identical output to
`org.down` (`app/src/lib/layout.ts`, the `layoutSheet` dispatch). `timeline.h`
falls through to the default branch and renders as a logic chart.

So two gallery cards promise a timeline and draw a chart already available under
another name: no axis, no date ordering, no milestone markers. Either give them
real timeline geometry, or drop the cards so the gallery stops overpromising.

## 4. Fit-to-screen never zooms in

The `⛶` control centers the map but does not scale it up to fill the viewport,
so a small map sits tiny in the middle of a large canvas. Minor, but it is the
first thing you reach for after switching chart type.
