<script lang="ts">
  import type { Sheet, Topic, TopicShape, StructureId } from "../../../src/index.js";

  let {
    sheet,
    topic,
    markDirty,
  }: { sheet: Sheet; topic: Topic | null; markDirty: () => void } = $props();

  const STRUCTURES: { id: StructureId; label: string }[] = [
    { id: "map.balanced", label: "Mind map · balanced" },
    { id: "map.right", label: "Mind map · right" },
    { id: "map.left", label: "Mind map · left" },
    { id: "logic.right", label: "Logic chart · right" },
    { id: "logic.left", label: "Logic chart · left" },
    { id: "org.down", label: "Org chart · down" },
    { id: "org.up", label: "Org chart · up" },
    { id: "tree.right", label: "Tree · right" },
    { id: "tree.left", label: "Tree · left" },
    { id: "timeline.h", label: "Timeline · horizontal" },
    { id: "timeline.v", label: "Timeline · vertical" },
    { id: "fishbone.right", label: "Fishbone · right" },
    { id: "fishbone.left", label: "Fishbone · left" },
    { id: "matrix", label: "Matrix" },
    { id: "tree-table", label: "Tree table" },
    { id: "brace.right", label: "Brace map · right" },
    { id: "brace.left", label: "Brace map · left" },
  ];
  const SHAPES: { id: TopicShape; label: string }[] = [
    { id: "rounded", label: "Rounded" },
    { id: "rect", label: "Rectangle" },
    { id: "capsule", label: "Capsule" },
    { id: "ellipse", label: "Ellipse" },
    { id: "underline", label: "Underline" },
    { id: "none", label: "No border" },
  ];
  const PRIORITY_COLORS: Record<string, string> = { "1": "#e5484d", "2": "#e98a3a", "3": "#3f7fd0" };
  const MARKERS = [
    { id: "task-start", icon: "🔵" }, { id: "task-25%", icon: "◔" }, { id: "task-50%", icon: "◑" },
    { id: "task-75%", icon: "◕" }, { id: "task-done", icon: "✅" },
    { id: "flag-red", icon: "🚩" }, { id: "flag-green", icon: "🏁" }, { id: "star", icon: "⭐" },
    { id: "idea", icon: "💡" }, { id: "question", icon: "❓" }, { id: "people", icon: "👤" },
    { id: "smiley", icon: "🙂" },
  ];
  const FONTS = [
    "Inter", "system-ui", "Arial", "Helvetica", "Georgia", "Times New Roman",
    "Courier New", "Verdana", "Tahoma", "Trebuchet MS", "Comic Sans MS", "Impact",
  ];
  const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
  const BORDER_WIDTHS = [1, 1.5, 2, 3, 4];
  const LINE_WIDTHS = [1.5, 2, 2.5, 3, 4];
  const EMOJIS = "😀 😄 😎 🤔 👍 👎 ❤️ 🔥 ⭐ ✨ ✅ ❌ ⚠️ ❗ ❓ 💡 📌 📎 📝 📅 ⏰ 🎯 🚀 🏆 💰 📈 📉 🔑 🔒 🐛 ✔️ ➡️ ⬅️ ⬆️ ⬇️ 🟢 🟡 🔴 🔵 ⚫".split(" ");
  const THEMES = [
    { id: "classic", bg: "#f5f6f8", root: "#33415c" },
    { id: "dark", bg: "#1f2430", root: "#3f7fd0" },
    { id: "paper", bg: "#fbf7ee", root: "#7a5c3a" },
    { id: "mint", bg: "#eef7f2", root: "#2f9e6f" },
    { id: "rose", bg: "#fdeef3", root: "#c2477e" },
  ];
  // Quick palette matching the canvas branch colors, plus neutrals.
  const SWATCHES = [
    "#e6584c", "#e98a3a", "#e7b93f", "#4fa84f", "#3aa6a6", "#3f7fd0",
    "#7a5cc9", "#c95ca0", "#33415c", "#64748b", "#ffffff", "#1c2230",
  ];

  // --- collapsible sections (persisted) --------------------------------------
  const SECT_KEY = "vynmm.inspector.sections";
  function loadSections(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(SECT_KEY);
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch { /* fall through to defaults */ }
    return { sheet: true, style: true, font: true, markers: false, emoji: false, content: true };
  }
  let open = $state<Record<string, boolean>>(loadSections());
  $effect(() => { localStorage.setItem(SECT_KEY, JSON.stringify(open)); });
  function toggle(id: string) { open[id] = !open[id]; }

  function expand(hex?: string): string {
    if (!hex) return "#ffffff";
    const m = /^#?([0-9a-f]{3})$/i.exec(hex);
    if (m) return "#" + m[1]!.split("").map((c) => c + c).join("");
    return hex.startsWith("#") ? hex : "#" + hex;
  }

  // Mutations operate directly on the proxied topic, then flag dirty.
  function setText(v: string) { if (topic) { topic.title = v; markDirty(); } }
  function setShape(v: TopicShape) { if (topic) { (topic.style ??= {}).shape = v; markDirty(); } }
  function setFill(v: string) { if (topic) { (topic.style ??= {}).fillColor = v; markDirty(); } }
  function clearFill() { if (topic?.style) { delete topic.style.fillColor; markDirty(); } }
  function setBorder(v: string) { if (topic) { (topic.style ??= {}).borderColor = v; markDirty(); } }
  function clearBorder() { if (topic?.style) { delete topic.style.borderColor; markDirty(); } }
  function setBorderWidth(v: number) { if (topic) { (topic.style ??= {}).borderWidth = v; markDirty(); } }
  function setLineColor(v: string) { if (topic) { (topic.style ??= {}).lineColor = v; markDirty(); } }
  function clearLineColor() { if (topic?.style) { delete topic.style.lineColor; markDirty(); } }
  function setLineWidth(v: number) { if (topic) { (topic.style ??= {}).lineWidth = v; markDirty(); } }
  function setFontColor(v: string) { if (topic) { ((topic.style ??= {}).font ??= {}).color = v; markDirty(); } }
  function clearFontColor() { if (topic?.style?.font) { delete topic.style.font.color; markDirty(); } }
  function resetStyle() { if (topic) { delete topic.style; markDirty(); } }
  function toggleBold() {
    if (!topic) return;
    const font = ((topic.style ??= {}).font ??= {});
    font.weight = font.weight === "bold" ? "normal" : "bold";
    markDirty();
  }
  function toggleItalic() {
    if (!topic) return;
    const font = ((topic.style ??= {}).font ??= {});
    font.style = font.style === "italic" ? "normal" : "italic";
    markDirty();
  }
  function setDecoration(d: "none" | "underline" | "line-through") {
    if (!topic) return;
    const font = ((topic.style ??= {}).font ??= {});
    font.decoration = font.decoration === d ? "none" : d;
    markDirty();
  }
  function setFontFamily(v: string) { if (topic) { ((topic.style ??= {}).font ??= {}).family = v || undefined; markDirty(); } }
  function setFontSize(v: number) { if (topic) { ((topic.style ??= {}).font ??= {}).size = v; markDirty(); } }
  function insertEmoji(e: string) { if (topic) { topic.title = (topic.title ?? "") + e; markDirty(); } }
  function applyTheme(id: string) {
    const th = THEMES.find((t) => t.id === id);
    if (!th) return;
    sheet.theme = th.id;
    sheet.background = { ...(sheet.background ?? {}), color: th.bg };
    (sheet.rootTopic.style ??= {}).fillColor = th.root;
    markDirty();
  }
  const font = $derived(topic?.style?.font);
  function hasMarker(id: string) { return topic?.markers?.includes(id) ?? false; }
  function toggleMarker(id: string) {
    if (!topic) return;
    const arr = (topic.markers ??= []);
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    markDirty();
  }
  function setNote(v: string) { if (topic) { topic.note = v ? { plain: v } : null; markDirty(); } }
  function setLink(v: string) { if (topic) { topic.hyperlink = v ? { type: "web", value: v } : null; markDirty(); } }
  function setLabels(v: string) {
    if (topic) { topic.labels = v.split(",").map((s) => s.trim()).filter(Boolean); markDirty(); }
  }
  function setStructure(v: string) { sheet.structure = v as StructureId; markDirty(); }
</script>

{#snippet swatches(set: (c: string) => void)}
  <div class="swatches">
    {#each SWATCHES as c (c)}
      <button class="sw" style={`background:${c}`} title={c} aria-label={`Set color ${c}`}
        onclick={() => set(c)}></button>
    {/each}
  </div>
{/snippet}

{#snippet sectionHeader(id: string, title: string)}
  <button class="sect" onclick={() => toggle(id)} aria-expanded={open[id] ?? false}>
    <span>{title}</span>
    <span class="chev" class:closed={!open[id]}>▾</span>
  </button>
{/snippet}

<aside class="inspector">
  <section>
    {@render sectionHeader("sheet", "Sheet")}
    {#if open.sheet}
      <div class="body">
        <label>Structure
          <select value={sheet.structure} onchange={(e) => setStructure(e.currentTarget.value)}>
            {#each STRUCTURES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
          </select>
        </label>
        <div class="fieldname">Theme</div>
        <div class="themes">
          {#each THEMES as t (t.id)}
            <button class="theme" class:on={sheet.theme === t.id} title={`${t.id} theme`}
              onclick={() => applyTheme(t.id)}>
              <span class="tbg" style={`background:${t.bg}`}>
                <span class="troot" style={`background:${t.root}`}></span>
              </span>
              <small>{t.id}</small>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  {#if topic}
    <section>
      {@render sectionHeader("style", "Topic style")}
      {#if open.style}
        <div class="body">
          <label>Text
            <textarea rows="2" value={topic.title}
              oninput={(e) => setText(e.currentTarget.value)}></textarea>
          </label>

          <label>Shape
            <select value={topic.style?.shape ?? "rounded"} onchange={(e) => setShape(e.currentTarget.value as TopicShape)}>
              {#each SHAPES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
            </select>
          </label>

          <div class="fieldname">Fill</div>
          {@render swatches(setFill)}
          <div class="colorline">
            <input type="color" value={expand(topic.style?.fillColor)} oninput={(e) => setFill(e.currentTarget.value)} />
            <button class="link" onclick={clearFill}>auto</button>
          </div>

          <div class="fieldname">Border</div>
          {@render swatches(setBorder)}
          <div class="colorline">
            <input type="color" value={expand(topic.style?.borderColor)} oninput={(e) => setBorder(e.currentTarget.value)} />
            <select class="mini" value={topic.style?.borderWidth ?? 1.5}
              onchange={(e) => setBorderWidth(Number(e.currentTarget.value))} title="Border width">
              {#each BORDER_WIDTHS as w (w)}<option value={w}>{w} px</option>{/each}
            </select>
            <button class="link" onclick={clearBorder}>auto</button>
          </div>

          <div class="fieldname">Branch line (to children)</div>
          <div class="colorline">
            <input type="color" value={expand(topic.style?.lineColor)} oninput={(e) => setLineColor(e.currentTarget.value)} />
            <select class="mini" value={topic.style?.lineWidth ?? 2.5}
              onchange={(e) => setLineWidth(Number(e.currentTarget.value))} title="Branch line width">
              {#each LINE_WIDTHS as w (w)}<option value={w}>{w} px</option>{/each}
            </select>
            <button class="link" onclick={clearLineColor}>auto</button>
          </div>

          <button class="reset" onclick={resetStyle}>Reset topic style</button>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader("font", "Font")}
      {#if open.font}
        <div class="body">
          <div class="row">
            <label class="col">Family
              <select value={font?.family ?? "Inter"} onchange={(e) => setFontFamily(e.currentTarget.value)}>
                {#each FONTS as f (f)}<option value={f}>{f}</option>{/each}
              </select>
            </label>
            <label style="width:64px">Size
              <select value={font?.size ?? 13} onchange={(e) => setFontSize(Number(e.currentTarget.value))}>
                {#each FONT_SIZES as s (s)}<option value={s}>{s}</option>{/each}
              </select>
            </label>
          </div>
          <div class="fieldname">Text color</div>
          {@render swatches(setFontColor)}
          <div class="colorline">
            <input type="color" value={expand(topic.style?.font?.color)} oninput={(e) => setFontColor(e.currentTarget.value)} />
            <button class="link" onclick={clearFontColor}>auto</button>
            <div class="fontbtns">
              <button class="ff bold" class:on={font?.weight === "bold"} title="Bold" onclick={toggleBold}>B</button>
              <button class="ff ital" class:on={font?.style === "italic"} title="Italic" onclick={toggleItalic}>I</button>
              <button class="ff und" class:on={font?.decoration === "underline"} title="Underline" onclick={() => setDecoration("underline")}>U</button>
              <button class="ff strike" class:on={font?.decoration === "line-through"} title="Strikethrough" onclick={() => setDecoration("line-through")}>S</button>
            </div>
          </div>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader("markers", "Markers")}
      {#if open.markers}
        <div class="body">
          <div class="fieldname">Priority</div>
          <div class="markers">
            {#each ["1", "2", "3"] as p (p)}
              <button class="prio" class:on={hasMarker(`priority-${p}`)} title={`Priority ${p}`}
                style={`--pc:${PRIORITY_COLORS[p]}`} onclick={() => toggleMarker(`priority-${p}`)}>
                <span>{p}</span>
              </button>
            {/each}
          </div>
          <div class="fieldname">Progress &amp; symbols</div>
          <div class="markers">
            {#each MARKERS as m (m.id)}
              <button class:on={hasMarker(m.id)} title={m.id} onclick={() => toggleMarker(m.id)}>{m.icon}</button>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader("emoji", "Insert emoji")}
      {#if open.emoji}
        <div class="body">
          <div class="emojis">
            {#each EMOJIS as e (e)}
              <button title={`Insert ${e}`} onclick={() => insertEmoji(e)}>{e}</button>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader("content", "Note · link · labels")}
      {#if open.content}
        <div class="body">
          <label>Note
            <textarea rows="3" value={topic.note?.plain ?? ""} oninput={(e) => setNote(e.currentTarget.value)}></textarea>
          </label>
          <label>Link
            <input type="url" placeholder="https://…" value={topic.hyperlink?.value ?? ""}
              oninput={(e) => setLink(e.currentTarget.value)} />
          </label>
          <label>Labels (comma-separated)
            <input value={topic.labels?.join(", ") ?? ""} oninput={(e) => setLabels(e.currentTarget.value)} />
          </label>
        </div>
      {/if}
    </section>
  {:else}
    <p class="hint">Select a topic to edit its style, markers, note, and link.</p>
  {/if}
</aside>

<style>
  .inspector {
    width: 280px; flex: none; height: 100%; overflow-y: auto;
    background: var(--panel); border-left: 1px solid var(--border);
    box-shadow: var(--elev-1);
    padding: 10px; font-size: 13px;
  }
  section { margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  section:last-of-type { border-bottom: none; }

  /* Collapsible section header */
  .sect {
    display: flex; align-items: center; justify-content: space-between; width: 100%;
    border: none; border-radius: 8px; background: transparent;
    padding: 8px 8px; margin: 0;
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--accent); font-weight: 700; text-align: left;
  }
  .sect:hover:not(:disabled) { background: var(--surface-2); }
  .chev { font-size: 11px; color: var(--muted); transition: transform 0.12s ease; }
  .chev.closed { transform: rotate(-90deg); }
  .body { padding: 4px 6px 8px; }

  .fieldname { color: var(--muted); font-size: 12px; margin: 10px 0 5px; }
  label { display: block; margin-bottom: 11px; color: var(--muted); font-size: 12px; }
  textarea, select, input[type="url"], input:not([type]) {
    width: 100%; margin-top: 4px; padding: 7px 9px;
    border: 1px solid var(--border); border-radius: 8px; font: inherit; color: var(--text);
    background: var(--panel); resize: vertical; transition: border-color 0.15s, box-shadow 0.15s;
  }
  textarea:focus, select:focus, input:focus {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .row { display: flex; gap: 10px; align-items: flex-end; }
  .col { flex: 1; }

  /* Quick color palette */
  .swatches { display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; margin-bottom: 6px; }
  .sw {
    aspect-ratio: 1; width: 100%; padding: 0; border-radius: 5px;
    border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
  }
  .sw:hover:not(:disabled) { transform: scale(1.15); box-shadow: var(--elev-1); }

  .colorline { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  input[type="color"] {
    width: 44px; height: 28px; padding: 0; flex: none;
    border: 1px solid var(--border); border-radius: 6px; background: var(--panel);
  }
  select.mini { width: auto; flex: 1; margin-top: 0; padding: 5px 6px; font-size: 12px; }
  .link { border: none; background: none; color: var(--accent); padding: 0 2px; font-size: 12px; flex: none; }
  .reset {
    width: 100%; margin-top: 10px; padding: 6px 10px; font-size: 12px;
    border-radius: 8px; color: var(--muted);
  }
  .reset:hover:not(:disabled) { color: #c0392b; border-color: #c0392b; background: color-mix(in srgb, #c0392b 6%, var(--panel)); }

  .fontbtns { display: flex; gap: 4px; margin-left: auto; }
  .ff { width: 28px; height: 28px; padding: 0; border-radius: 7px; }
  .ff.bold { font-weight: 700; }
  .ff.ital { font-style: italic; font-family: Georgia, serif; }
  .ff.und { text-decoration: underline; }
  .ff.strike { text-decoration: line-through; }
  .ff.on { background: var(--accent); color: var(--md-on-primary); border-color: var(--accent); }

  .markers { display: flex; flex-wrap: wrap; gap: 4px; }
  .markers button { width: 30px; height: 30px; padding: 0; font-size: 14px; border-radius: 8px; }
  .markers button.on { background: color-mix(in srgb, var(--accent) 20%, var(--panel)); border-color: var(--accent); }
  .prio span {
    display: inline-grid; place-items: center; width: 18px; height: 18px;
    border-radius: 50%; background: var(--pc); color: #fff; font-size: 11px; font-weight: 700;
  }
  .prio.on { border-color: var(--pc); background: color-mix(in srgb, var(--pc) 14%, var(--panel)); }

  .emojis { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; }
  .emojis button { padding: 0; height: 26px; font-size: 15px; border-color: transparent; background: none; }
  .emojis button:hover { background: var(--surface-2); border-color: var(--border); }

  /* Theme swatches */
  .themes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  .theme {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 5px 2px; border-radius: 9px; border: 1px solid var(--border); background: var(--panel);
  }
  .theme.on { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); }
  .theme .tbg {
    width: 30px; height: 22px; border-radius: 5px; display: grid; place-items: center;
    border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  }
  .theme .troot { width: 14px; height: 8px; border-radius: 3px; }
  .theme small { font-size: 10px; color: var(--muted); }

  .hint { color: var(--muted); padding: 6px; }
</style>
