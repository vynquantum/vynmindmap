# VynMindMap user guide

Everything the app can do, and how to reach it. If you only read one section,
read [Your first map](#your-first-map) and the
[keyboard shortcuts](#keyboard-shortcuts).

- [Your first map](#your-first-map)
- [Getting around the canvas](#getting-around-the-canvas)
- [Building the tree](#building-the-tree)
- [Moving branches: attach, detach, reparent](#moving-branches-attach-detach-reparent)
- [Copy, cut, paste, duplicate](#copy-cut-paste-duplicate)
- [Collapsing and expanding](#collapsing-and-expanding)
- [Floating topics](#floating-topics)
- [Relationships, boundaries, summaries](#relationships-boundaries-summaries)
- [Styling a topic](#styling-a-topic)
- [Notes, links, labels, images, markers](#notes-links-labels-images-markers)
- [Changing the chart type](#changing-the-chart-type)
- [Map-wide layout options](#map-wide-layout-options)
- [Sheets](#sheets)
- [The outline panel](#the-outline-panel)
- [Finding topics](#finding-topics)
- [Presenting](#presenting)
- [Saving, opening, exporting](#saving-opening-exporting)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Known limitations](#known-limitations)

---

## Your first map

1. Launch the app. You get a new map with a single root topic.
2. Click the root to select it. Press **Tab** to add a child; the new topic
   opens for editing straight away — just type.
3. Press **Enter** to add a sibling next to whatever is selected.
4. Press **Esc** or click anywhere else on the canvas to finish typing. Both
   commit what you typed; nothing is lost.
5. **Ctrl+S** saves to a `.vmm` file.

That loop — Tab for deeper, Enter for wider, type, Esc — is the whole editor.
Everything below is refinement.

If a blank canvas is the wrong place to start, the welcome screen offers
**templates** — meeting notes, project plan, retrospective, decision, SWOT,
study notes. Picking one opens an unsaved map with the branches already there;
edit or delete anything you don't need, then save it wherever you like. Below
them, **sample maps** show off styling, relationships and every chart type.

## Getting around the canvas

| You want to           | Do this                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Pan                   | Drag empty canvas, or scroll with the mouse wheel                                             |
| Zoom in / out         | **Ctrl+=** / **Ctrl+-**, or the ± buttons bottom-left                                         |
| Back to 100%          | **Ctrl+0**, or click the percentage in the zoom bar                                           |
| Fit the map on screen | Right-click empty canvas → **Fit map to view** (scales up as well as down, to a 150% ceiling) |
| Jump somewhere far    | Drag inside the minimap (bottom-right)                                                        |
| Hide all the chrome   | **F8** toggles full-window (zen) mode                                                         |

Keyboard selection auto-pans: arrow-key your way off-screen and the canvas
follows you.

## Building the tree

Select a topic first — everything here acts on the selection.

- **Tab** (or **Insert**) — add a child
- **Enter** — add a sibling
- **F2** or double-click — rename; **Shift+Enter** inside the editor inserts a
  line break, so titles can be multi-line
- **Delete** / **Backspace** — delete the topic and everything under it
- **Arrow keys** — move the selection through the tree
- **Shift-click** — add another topic to the selection
- **Esc** — clear the selection

Long titles word-wrap by themselves. Right-clicking a topic gives you the same
actions in a menu: Add child, Add sibling, Rename, Relate, Copy, Cut, Paste as
child, Duplicate, Collapse/Expand, Delete.

## Moving branches: attach, detach, reparent

Drag the topic itself.

- **Drop it on another topic** — it becomes that topic's child. The target
  highlights while you hover it, so you can see where it will land.
- **Drop it on empty canvas** — it detaches from its parent and becomes a
  floating topic, anchored where you dropped it.
- **Drop a floating topic on a real one** — it attaches as a child.

The whole subtree travels with the topic you drag. Press **Esc** mid-drag to
call the whole thing off.

If you turn on **Free Branch Position** (Inspector → Map), dropping on empty
canvas repositions the branch instead of detaching it — useful when you want to
hand-place branches without breaking the tree.

## Copy, cut, paste, duplicate

- **Ctrl+C** copies the selected topic _and its subtree_
- **Ctrl+X** cuts it out
- **Ctrl+V** pastes it as a child of whatever is selected
- **Ctrl+D** duplicates in place

The clipboard survives sheet switches, so you can copy on one sheet and paste
on another. To drop a copy somewhere specific, right-click empty canvas and
choose **Paste here** — it lands as a floating topic at the cursor.

Copy also puts the map on the **system clipboard**, so it travels further:

- Paste into another VynMM window, or another document, and the whole subtree
  arrives with its styles, notes, images and children intact.
- Paste into a text editor, chat, or email and you get a plain indented
  outline.
- Paste an outline _from_ anywhere back into a map and the indentation becomes
  the tree — tabs, two spaces or four all work.
- Paste an image while a topic is selected and it attaches to that topic.

Pasted topics get fresh ids, so nothing collides with the original.

## Collapsing and expanding

| Key          | Effect                                                       |
| ------------ | ------------------------------------------------------------ |
| **Space**    | Collapse/expand the selected topic one level                 |
| **-**        | Collapse the selected topic                                  |
| **=**        | Expand the selected topic                                    |
| **/**        | Collapse the entire subtree under the selection, recursively |
| **\***       | Expand the entire subtree, recursively                       |
| **Ctrl+/**   | Collapse every branch on the sheet, whatever is selected     |
| **Ctrl+\***  | Expand every branch on the sheet, whatever is selected       |
| **Ctrl+1…9** | Fold the whole map to that many levels                       |

With nothing selected, **/** and **\*** act on the whole map too. Collapse-all
leaves the central topic open, so you're left looking at the top-level
branches rather than a single box. Both are also in the right-click menu:
**Expand / Collapse branch** on a topic, **Expand all / Collapse all** on empty
canvas. Topics with hidden children show a toggle you can click instead.

## Floating topics

A floating topic sits on the canvas with no parent — a parking lot, a caption,
an idea you haven't placed yet.

- **Double-click empty canvas**, or right-click → **New floating topic**
- It opens for editing immediately; type, then click away or press Esc
- Give it children with Tab, exactly like a rooted topic
- Drag it onto a real topic when you're ready to fold it into the tree

## Relationships, boundaries, summaries

**Relationship** — a dashed arrow between any two topics, regardless of where
they sit in the tree. Select a topic, click **Relate →** in the action bar (or
right-click → Relate), then click the target. Double-click the arrow to give it
a label; click it once to select it, then Delete to remove it.

**Boundary** — a dashed outline drawn around a group of sibling topics.
**Shift-click** (or Ctrl/Cmd-click) to select two or more _contiguous
siblings_ — the action bar appears and says "2 topics" — then click **Add
boundary**. Click the outline later to select it; the action bar then offers
**Delete**.

> Boundaries and summaries only work on siblings that sit next to each other
> under the same parent. If you select two topics with different parents, the
> action bar stays empty — that's the guard, not a bug.

**Summary** — a brace spanning a group plus a new topic that summarises it.
Same selection, click **Add summary**; a new "Summary" topic appears.

## Styling a topic

Open the style panel (toolbar, or the button on a selected topic). Selecting a
topic brings the **Style** tab up by itself; it stays where you leave it while
that topic is selected, so you can work in **Map** without it jumping back.

The **Style** tab holds:

- **Size & wrapping** — fixed width, wrap behaviour
- **Appearance** — fill colour, border colour, shape
- **Font** — family, size, weight, colour, bold / italic / underline /
  strikethrough, and **Alignment** (left, centre, right). Alignment applies to
  the title and any note shown under it; topics are centred unless you say
  otherwise.
- **Markers** — **Priority** 1–9 as coloured numbered chips, plus a **Progress
  & symbols** row (task start / 25% / 50% / 75% / done, flags, stars, heart,
  idea, question, warning, info, cross, check, rocket, fire, bomb…). Click to
  toggle one on, click again to remove it.
- **Insert emoji** — drop an emoji straight into the title
- **Note · link · labels · image** — see below

Styles are per topic. Nothing you set here changes the map's geometry — that's
the Map tab.

## Notes, links, labels, images, markers

All in the Style tab's last section:

- **Note** — long-form text attached to a topic; shows a small badge on the
  node. Turn on _Display All Notes_ (Map tab) to render them inline.
- **Link** — one of four kinds: a **web** URL, a local **file** path, another
  **topic** in the map, or an **email** address.
- **Labels** — short tags rendered under the title.
- **Image** — an image embedded in the node, drawn above the title. It arrives
  at its own aspect ratio; resize it by dragging the small handle at its
  top-right corner (hold **Shift** to stretch it freely), by typing an **Image
  width / height**, or double-click the handle to go back to the attached size.
  You can also drop an image file onto a topic, or paste one from the
  clipboard.
- **Markers** — icon chips shown before the title; priority markers render as
  coloured numbered chips.

## Changing the chart type

The **Map** tab holds the structure gallery: 31 layouts across 10 families.

| Family      | Variants                                                             |
| ----------- | -------------------------------------------------------------------- |
| Mind Map    | balanced, right, left, text-on-lines, capsule, straight lines, elbow |
| Logic Chart | right, left, curved, capsule                                         |
| Org Chart   | down, up, straight, capsule                                          |
| Tree Chart  | right, left, curved                                                  |
| Timeline    | horizontal, vertical, capsule                                        |
| Fishbone    | right, left, capsule                                                 |
| Brace Map   | right, left, capsule                                                 |
| Tree Table  | —                                                                    |
| Matrix      | —                                                                    |
| Grid        | plain, rounded cards                                                 |

Click a card and the map re-lays out immediately. Your content doesn't change,
only the geometry — switch freely and switch back.

## Map-wide layout options

Also on the **Map** tab, as toggles:

- **Compact Map** — tighter spacing
- **Uniform Topic Length** — every node the same width
- **Display All Notes** — render notes inline instead of as badges
- **Wrap Text** — on by default; turn it off and every title stays on one line,
  widening its topic instead. Line breaks you typed yourself still break, and a
  fixed width becomes a minimum rather than a wrap point.
- **Auto-colour Floating Topic** — give new floating topics their own colours
- **Line Colour Follow Topic** — branch lines take the topic's colour
- **Free Branch Position** — drop on empty canvas repositions instead of
  detaching (see [Moving branches](#moving-branches-attach-detach-reparent))
- **Flexible Floating Topic** — looser placement rules for floating topics
- **Topic Overlap** — allow nodes to overlap rather than pushing each other apart

## Sheets

One `.vmm` file can hold several maps, as sheets, shown as tabs below the
canvas.

- **+** adds a sheet
- Click a tab to switch
- **Double-click** a tab to rename it
- **×** on the tab closes it (it appears on the active tab and on hover)

Tabs behave like a browser's: they share the strip and shrink as you add more,
long names truncate with an ellipsis rather than wrapping the bar onto a second
row, and once they hit their minimum the strip scrolls sideways with the
current tab kept in view. Hover a truncated tab to see its full name.

The clipboard is shared across sheets, so copy on one and paste on another.

## The outline panel

Toggle it from the toolbar. It shows the map as an indented text outline — good
for reading a big map quickly, and for checking structure without the visual
noise. Selecting in the outline selects on the canvas.

## Finding topics

**Ctrl+F** opens the find bar. Type; matches are counted and highlighted.
**Enter** goes to the next match, **Shift+Enter** to the previous, **F3** does
the same without reopening the bar, **Esc** closes. The canvas pans to each
match.

Find looks at **titles, notes, labels and markers** — the sentence you're after
is usually in a note rather than a heading. When the hit was outside the title,
the counter says where (`3/7 in note`), so a jump to a topic that doesn't
visibly contain the words still makes sense.

## Presenting

Click the presenter button in the toolbar. Zen mode turns on by itself, so the
toolbar and panels get out of the way.

VynMM presents **the map itself**, not a generated slide deck: **PageDown** and
**PageUp** walk topics one at a time, zooming to each, expanding collapsed
branches on the way. The audience sees the structure and how each point hangs
off it, which is the argument a mind map is making. A second window gives you
the presenter view — the current topic's note, what's next, progress, a timer,
and a clock.

Editing chrome stays out of the picture while you present: the note, link and
image badges, the collapse toggles, the zoom bar and the minimap are all
hidden, so the audience sees the map and nothing else. They come back the
moment you leave presenter mode, and exports are unaffected.

The walk order is depth-first through the tree, then any floating topics, so
it follows the map top to bottom. You can't reorder it or skip branches; every
topic gets its turn. If you need something to hand out afterwards, export to
PDF or PNG rather than presenting.

## Saving, opening, exporting

| Action      | Shortcut                                      |
| ----------- | --------------------------------------------- |
| New map     | **Ctrl+N**                                    |
| Open        | **Ctrl+O**                                    |
| Save        | **Ctrl+S**                                    |
| Save As     | **Ctrl+Shift+S**                              |
| Close map   | **Ctrl+W**                                    |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** (or **Ctrl+Shift+Z**) |

Maps save as `.vmm` files on your own disk — no account, no cloud.
**Autosave** can be toggled in the toolbar. If you try to close with unsaved
changes, you get a warning.

**Import**: the upload button in the toolbar reads Markdown (`.md`), OPML
(`.opml`) and `.xmind` files — pick several at once and each becomes its own
tab. An `.xmind` brings its structure, notes, labels, markers, links, images,
relationships, boundaries and summaries across; a file written by XMind 8 or
older says so and asks you to re-save it in a current version first. **Export**: the Export menu offers Markdown (`.md`),
Image (`.png`), Vector (`.svg`) and Document (`.pdf`). SVG is the one to pick
for a slide, a poster or any print: it stays sharp at any size and opens in
Illustrator, Inkscape or Figma as editable shapes. Markdown export keeps everything except
the image files themselves, so you can edit a map in a text editor and import it
back without losing styles, links, boundaries or floating topics.

**Drag and drop**: drop `.vmm`, `.md`, `.opml` or `.xmind` files straight onto
the window. With
nothing open, a single `.vmm` opens as itself (Save writes back to that file);
anything else — several files, or Markdown — arrives as extra tabs on the map
you already have open, exactly like Merge.

**Merge**: the layers button folds other maps into the one you have open — pick
any mix of the formats above and every sheet in them arrives as a new tab.
Nothing is overwritten: maps that share topic ids, images or tab names get the
copies renamed, and the files you picked are left as they were.

The Markdown lane is also how AI tools read and write these maps — see
[vmm-markdown-format.md](vmm-markdown-format.md).

## Keyboard shortcuts

### File and app

| Key                    | Action              |
| ---------------------- | ------------------- |
| Ctrl+N                 | New map             |
| Ctrl+O                 | Open                |
| Ctrl+S / Ctrl+Shift+S  | Save / Save As      |
| Ctrl+W                 | Close map           |
| Ctrl+Z                 | Undo                |
| Ctrl+Y or Ctrl+Shift+Z | Redo                |
| F8                     | Full-window (zen)   |
| PageDown / PageUp      | Present next / prev |
| F1 or ?                | Show every shortcut |

### Editing

| Key                      | Action                                          |
| ------------------------ | ----------------------------------------------- |
| Tab / Insert             | Add child                                       |
| Enter                    | Add sibling after                               |
| Shift+Enter              | Add sibling before (line break while renaming)  |
| Ctrl+Enter               | Insert a parent above the selection             |
| Ctrl+Shift+↑ / ↓         | Move the topic among its siblings               |
| Ctrl+A                   | Select every topic on the sheet                 |
| Home                     | Select and centre the central topic             |
| F2                       | Rename (double-click also works)                |
| Esc                      | Commit the edit / cancel drag / clear selection |
| Delete or Backspace      | Delete topic and subtree                        |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy / Cut / Paste as child                     |
| Ctrl+D                   | Duplicate                                       |
| Ctrl+L                   | Start a relationship from the selection         |
| Ctrl+Shift+B             | Boundary around the selected siblings           |
| Ctrl+]                   | Summary of the selected siblings                |

### View

| Key                 | Action                          |
| ------------------- | ------------------------------- |
| Arrow keys          | Move selection                  |
| Shift-click a topic | Add it to the selection         |
| Space               | Collapse/expand one level       |
| `-` / `=`           | Collapse / expand selected      |
| `/` / `*`           | Collapse / expand whole subtree |
| Ctrl+/ / Ctrl+\*    | Collapse / expand the sheet     |
| Ctrl+1 … Ctrl+9     | Fold the map to that level      |
| Ctrl+F              | Find                            |
| F3 / Shift+F3       | Next / previous match           |
| Ctrl+= / Ctrl+-     | Zoom in / out                   |
| Ctrl+0              | Zoom to 100%                    |

> On macOS use **Cmd** wherever this table says Ctrl.

## Accessibility

- Every icon-only button, colour picker and toolbar control has a spoken
  name, so a screen reader announces what it does rather than "button".
- Dialogs (confirmations, the shortcut sheet) keep **Tab** inside them and
  give focus back to where you were when they close; **Esc** always closes.
- Turning on your system's **reduce motion** setting removes the app's fades
  and pop animations.
- Focus outlines follow the keyboard, not the mouse: they appear when you Tab,
  not when you click.

## Known limitations

Honest list of what doesn't work yet, tracked in
[BACKLOG.md](../BACKLOG.md):

Nothing outstanding here at the moment. Every one of the 31 gallery layouts
draws every topic in the sheet, and no two of them are the same chart under
different names.
