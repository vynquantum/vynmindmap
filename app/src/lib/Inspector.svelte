<script lang="ts">
  import type { Sheet, Topic, TopicShape, StructureId } from "../../../src/index.js";

  let {
    sheet,
    topic,
    markDirty,
  }: { sheet: Sheet; topic: Topic | null; markDirty: () => void } = $props();

  const STRUCTURES: StructureId[] = [
    "map.balanced", "map.right", "map.left",
    "logic.right", "logic.left", "org.down", "org.up",
    "tree.right", "tree.left", "timeline.h", "timeline.v",
    "fishbone.right", "fishbone.left", "matrix", "tree-table", "brace.right", "brace.left",
  ];
  const SHAPES: TopicShape[] = ["rounded", "rect", "capsule", "ellipse", "underline", "none"];
  const MARKERS = [
    { id: "priority-1", icon: "1" }, { id: "priority-2", icon: "2" }, { id: "priority-3", icon: "3" },
    { id: "flag-red", icon: "🚩" }, { id: "star", icon: "⭐" }, { id: "task-done", icon: "✅" },
    { id: "idea", icon: "💡" }, { id: "question", icon: "❓" }, { id: "people", icon: "👤" },
  ];
  const FONTS = [
    "Inter", "system-ui", "Arial", "Helvetica", "Georgia", "Times New Roman",
    "Courier New", "Verdana", "Tahoma", "Trebuchet MS", "Comic Sans MS", "Impact",
  ];
  const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
  const EMOJIS = "😀 😄 😎 🤔 👍 👎 ❤️ 🔥 ⭐ ✨ ✅ ❌ ⚠️ ❗ ❓ 💡 📌 📎 📝 📅 ⏰ 🎯 🚀 🏆 💰 📈 📉 🔑 🔒 🐛 ✔️ ➡️ ⬅️ ⬆️ ⬇️ 🟢 🟡 🔴 🔵 ⚫".split(" ");
  const THEMES = [
    { id: "classic", bg: "#f5f6f8", root: "#33415c" },
    { id: "dark", bg: "#1f2430", root: "#3f7fd0" },
    { id: "paper", bg: "#fbf7ee", root: "#7a5c3a" },
    { id: "mint", bg: "#eef7f2", root: "#2f9e6f" },
    { id: "rose", bg: "#fdeef3", root: "#c2477e" },
  ];

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
  function setFontColor(v: string) { if (topic) { ((topic.style ??= {}).font ??= {}).color = v; markDirty(); } }
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

<aside class="inspector">
  <section>
    <h3>Sheet</h3>
    <label>Structure
      <select value={sheet.structure} onchange={(e) => setStructure(e.currentTarget.value)}>
        {#each STRUCTURES as s (s)}<option value={s}>{s}</option>{/each}
      </select>
    </label>
    <label>Theme
      <select value={sheet.theme} onchange={(e) => applyTheme(e.currentTarget.value)}>
        {#each THEMES as t (t.id)}<option value={t.id}>{t.id}</option>{/each}
      </select>
    </label>
  </section>

  {#if topic}
    <section>
      <h3>Topic</h3>
      <label>Text
        <textarea rows="2" value={topic.title}
          oninput={(e) => setText(e.currentTarget.value)}></textarea>
      </label>

      <label>Shape
        <select value={topic.style?.shape ?? "rounded"} onchange={(e) => setShape(e.currentTarget.value as TopicShape)}>
          {#each SHAPES as s (s)}<option value={s}>{s}</option>{/each}
        </select>
      </label>

      <div class="row">
        <label class="col">Fill
          <span class="colorline">
            <input type="color" value={expand(topic.style?.fillColor)} oninput={(e) => setFill(e.currentTarget.value)} />
            <button class="link" onclick={clearFill}>clear</button>
          </span>
        </label>
        <label class="col">Border
          <input type="color" value={expand(topic.style?.borderColor)} oninput={(e) => setBorder(e.currentTarget.value)} />
        </label>
      </div>

      <h4>Font</h4>
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
      <div class="row">
        <label class="col">Text color
          <input type="color" value={expand(topic.style?.font?.color)} oninput={(e) => setFontColor(e.currentTarget.value)} />
        </label>
        <div class="fontbtns">
          <button class="ff bold" class:on={font?.weight === "bold"} title="Bold" onclick={toggleBold}>B</button>
          <button class="ff ital" class:on={font?.style === "italic"} title="Italic" onclick={toggleItalic}>I</button>
          <button class="ff und" class:on={font?.decoration === "underline"} title="Underline" onclick={() => setDecoration("underline")}>U</button>
          <button class="ff strike" class:on={font?.decoration === "line-through"} title="Strikethrough" onclick={() => setDecoration("line-through")}>S</button>
        </div>
      </div>

      <h4>Markers</h4>
      <div class="markers">
        {#each MARKERS as m (m.id)}
          <button class:on={hasMarker(m.id)} title={m.id} onclick={() => toggleMarker(m.id)}>{m.icon}</button>
        {/each}
      </div>

      <h4>Insert emoji</h4>
      <div class="emojis">
        {#each EMOJIS as e (e)}
          <button title={`Insert ${e}`} onclick={() => insertEmoji(e)}>{e}</button>
        {/each}
      </div>

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
    </section>
  {:else}
    <p class="hint">Select a topic to edit its style, markers, note, and link.</p>
  {/if}
</aside>

<style>
  .inspector {
    width: 264px; flex: none; height: 100%; overflow-y: auto;
    background: var(--panel); border-left: 1px solid var(--border);
    box-shadow: var(--elev-1);
    padding: 14px; font-size: 13px;
  }
  section { margin-bottom: 18px; }
  h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--accent); font-weight: 700; }
  h4 { margin: 14px 0 6px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; }
  label { display: block; margin-bottom: 11px; color: var(--muted); font-size: 12px; }
  textarea, select, input[type="url"], input:not([type]) {
    width: 100%; margin-top: 4px; padding: 7px 9px;
    border: 1px solid var(--border); border-radius: 8px; font: inherit; color: var(--text);
    background: #fff; resize: vertical; transition: border-color 0.15s, box-shadow 0.15s;
  }
  textarea:focus, select:focus, input:focus {
    outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .row { display: flex; gap: 10px; align-items: flex-end; }
  .col { flex: 1; }
  .colorline { display: flex; align-items: center; gap: 6px; }
  input[type="color"] { width: 100%; height: 28px; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: #fff; }
  .link { border: none; background: none; color: var(--accent); padding: 0; font-size: 12px; }
  .fontbtns { display: flex; gap: 4px; }
  .ff { width: 30px; height: 30px; padding: 0; }
  .ff.bold { font-weight: 700; }
  .ff.ital { font-style: italic; font-family: Georgia, serif; }
  .ff.und { text-decoration: underline; }
  .ff.strike { text-decoration: line-through; }
  .ff.on { background: var(--accent); color: #fff; border-color: var(--accent); }
  .markers { display: flex; flex-wrap: wrap; gap: 4px; }
  .markers button { width: 30px; height: 30px; padding: 0; font-size: 14px; }
  .markers button.on { background: #dbeafe; border-color: var(--accent); }
  .emojis { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; }
  .emojis button { padding: 0; height: 26px; font-size: 15px; border-color: transparent; background: none; }
  .emojis button:hover { background: #eef1f6; border-color: var(--border); }
  .hint { color: var(--muted); }
</style>
