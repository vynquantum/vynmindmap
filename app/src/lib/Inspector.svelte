<script lang="ts">
  import type { Sheet, Topic, TopicShape, StructureId } from "../../../src/index.js";

  let {
    sheet,
    topic,
    markDirty,
    onClose,
  }: { sheet: Sheet; topic: Topic | null; markDirty: () => void; onClose?: () => void } = $props();

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
  const PRIORITY_COLORS: Record<string, string> = {
    "1": "#e5484d", "2": "#e98a3a", "3": "#3f7fd0", "4": "#3aa6a6", "5": "#4fa84f",
    "6": "#e7b93f", "7": "#7a5cc9", "8": "#c95ca0", "9": "#64748b"
  };
  const MARKERS = [
    { id: "task-start", icon: "🔵" }, { id: "task-25%", icon: "◔" }, { id: "task-50%", icon: "◑" },
    { id: "task-75%", icon: "◕" }, { id: "task-done", icon: "✅" },
    { id: "flag-red", icon: "🚩" }, { id: "flag-green", icon: "🏁" }, { id: "flag-blue", icon: "🗳️" },
    { id: "star", icon: "⭐" }, { id: "star-blue", icon: "🌟" }, { id: "heart", icon: "❤️" },
    { id: "idea", icon: "💡" }, { id: "question", icon: "❓" }, { id: "warning", icon: "⚠️" },
    { id: "info", icon: "ℹ️" }, { id: "cross", icon: "❌" }, { id: "check", icon: "✔️" },
    { id: "rocket", icon: "🚀" }, { id: "fire", icon: "🔥" }, { id: "bomb", icon: "💣" },
    { id: "money", icon: "💰" }, { id: "calendar", icon: "📅" }, { id: "clock", icon: "⏰" },
    { id: "chart-up", icon: "📈" }, { id: "chart-down", icon: "📉" }, { id: "pin", icon: "📌" },
    { id: "key", icon: "🔑" }, { id: "lock", icon: "🔒" }, { id: "people", icon: "👤" },
    { id: "smiley", icon: "🙂" }, { id: "wink", icon: "😉" }, { id: "thumb-up", icon: "👍" },
    { id: "thumb-down", icon: "👎" }
  ];
  const FONTS = [
    "Inter", "system-ui", "Outfit", "Roboto", "Montserrat", "Playfair Display",
    "Merriweather", "JetBrains Mono", "Fira Code", "Pacifico", "Dancing Script",
    "Caveat", "Architects Daughter", "Satisfy", "Open Sans", "Lato", "Poppins",
    "Nunito", "Rubik", "Quicksand", "Arial", "Helvetica", "Georgia", "Times New Roman",
    "Courier New", "Verdana", "Tahoma", "Trebuchet MS", "Comic Sans MS", "Impact"
  ];
  const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
  const BORDER_WIDTHS = [1, 1.5, 2, 3, 4];
  const LINE_WIDTHS = [1.5, 2, 2.5, 3, 4];

  const EMOJI_CATEGORIES = [
    {
      name: "Smileys",
      icon: "😀",
      emojis: [
        { char: "😀", tags: "smile happy grin" }, { char: "😄", tags: "smile happy laugh" }, 
        { char: "😆", tags: "laugh squint happy" }, { char: "😅", tags: "sweat laugh happy" }, 
        { char: "😂", tags: "joy tears laugh cry" }, { char: "🤣", tags: "rofl laugh floor" }, 
        { char: "😊", tags: "blush smile happy" }, { char: "😇", tags: "angel halo innocent" }, 
        { char: "🙂", tags: "slight smile" }, { char: "🙃", tags: "upside down" }, 
        { char: "😉", tags: "wink eye" }, { char: "😌", tags: "relieved peace calm" }, 
        { char: "😍", tags: "heart eyes love" }, { char: "🥰", tags: "hearts love warm" }, 
        { char: "😘", tags: "kiss love blow" }, { char: "😋", tags: "yum tongue delicious" }, 
        { char: "😜", tags: "wink tongue crazy" }, { char: "🤪", tags: "zany crazy wild" }, 
        { char: "🤨", tags: "raised eyebrow skeptic" }, { char: "🧐", tags: "monocle inspector investigate" }, 
        { char: "🤓", tags: "nerd geek glasses" }, { char: "😎", tags: "cool sunglasses glasses" }, 
        { char: "🥳", tags: "party celebrate hat" }, { char: "😏", tags: "smirk sly" }, 
        { char: "😒", tags: "unamused meh" }, { char: "😞", tags: "sad disappointed" }, 
        { char: "😔", tags: "pensive sad" }, { char: "😟", tags: "worried concern" }, 
        { char: "😕", tags: "confused" }, { char: "🥺", tags: "pleading eyes beg puppy" }, 
        { char: "😢", tags: "cry sad tear" }, { char: "😭", tags: "sob cry heavy" }, 
        { char: "😤", tags: "steam nose angry pride" }, { char: "😠", tags: "angry mad" }, 
        { char: "😡", tags: "rage angry red" }, { char: "🤬", tags: "cursing mouth swear" }, 
        { char: "🤯", tags: "mind blown explode shock" }, { char: "😳", tags: "flushed blush shock" }, 
        { char: "🥵", tags: "hot red sweat summer" }, { char: "🥶", tags: "cold blue freeze winter" }, 
        { char: "😱", tags: "scream fear gasp" }, { char: "😴", tags: "sleep zzz tired" }, 
        { char: "🤤", tags: "drool sleep" }, { char: "😪", tags: "sleepy bubble" },
        { char: "🥴", tags: "woozy dizzy" }, { char: "🤢", tags: "nausea green sick" }, 
        { char: "🤮", tags: "vomit sick" }, { char: "🤧", tags: "sneeze cold nose" }, 
        { char: "😷", tags: "mask sick hospital" }
      ]
    },
    {
      name: "Gestures",
      icon: "👋",
      emojis: [
        { char: "👋", tags: "wave hello goodbye" }, { char: "👌", tags: "ok correct good" }, 
        { char: "✌️", tags: "victory peace hand" }, { char: "🤞", tags: "cross fingers luck" }, 
        { char: "🤟", tags: "love sign" }, { char: "🤘", tags: "rock metal horns" }, 
        { char: "👈", tags: "point left" }, { char: "👉", tags: "point right" }, 
        { char: "👆", tags: "point up" }, { char: "👇", tags: "point down" }, 
        { char: "👍", tags: "thumbs up like approve yes" }, { char: "👎", tags: "thumbs down dislike reject no" }, 
        { char: "👏", tags: "clap hand applause" }, { char: "🙌", tags: "hooray celebrate raise hands" }, 
        { char: "👐", tags: "open hands" }, { char: "🤲", tags: "palms together" }, 
        { char: "🤝", tags: "handshake agree deal partnership" }, { char: "🙏", tags: "pray please thank you hands" }, 
        { char: "✍️", tags: "write pen sign" }, { char: "💪", tags: "flex biceps strong power muscle" }, 
        { char: "🧠", tags: "brain mind think smart intelligence" }, { char: "🧡", tags: "orange heart" }, 
        { char: "💛", tags: "yellow heart" }, { char: "💚", tags: "green heart" }, 
        { char: "💙", tags: "blue heart" }, { char: "💜", tags: "purple heart" }, 
        { char: "🖤", tags: "black heart" }, { char: "🤍", tags: "white heart" }, 
        { char: "💔", tags: "broken heart sad" }, { char: "❤️", tags: "red heart love" }, 
        { char: "🔥", tags: "fire flame hot trend" }, { char: "✨", tags: "sparkles magic shiny" }
      ]
    },
    {
      name: "Office",
      icon: "💻",
      emojis: [
        { char: "💻", tags: "laptop computer notebook code developer" }, { char: "🖥️", tags: "desktop monitor screen" }, 
        { char: "📱", tags: "phone mobile cell smartphone" }, { char: "💾", tags: "save floppy disk" }, 
        { char: "📁", tags: "folder file document" }, { char: "📂", tags: "open folder file" }, 
        { char: "📄", tags: "page document paper sheet" }, { char: "📑", tags: "tabs bookmark document" }, 
        { char: "📊", tags: "bar chart stats metrics report" }, { char: "📈", tags: "chart line growth metrics trend up" }, 
        { char: "📉", tags: "chart line decline decrease metrics trend down" }, { char: "📜", tags: "scroll history paper" }, 
        { char: "📋", tags: "clipboard copy paste list" }, { char: "📌", tags: "pin pushpin map location board" }, 
        { char: "📍", tags: "pin red map location point" }, { char: "📎", tags: "paperclip attach document link" }, 
        { char: "✉️", tags: "envelope mail letter inbox" }, { char: "📦", tags: "package box delivery parcel" }, 
        { char: "📝", tags: "memo note write paper editor" }, { char: "✏️", tags: "pencil write draw" }, 
        { char: "✒️", tags: "nib pen write sign" }, { char: "📏", tags: "ruler scale measure" }, 
        { char: "📐", tags: "triangle ruler scale geometry measure" }, { char: "🔑", tags: "key password secret open access" }, 
        { char: "🔒", tags: "lock closed secure privacy safe" }, { char: "🔓", tags: "unlock open insecure access" }, 
        { char: "🛡️", tags: "shield protect security safe" }, { char: "⚙️", tags: "gear settings configure build options" }, 
        { char: "🛠️", tags: "tools hammer wrench build configure fix repair" }, { char: "🔬", tags: "microscope science research test" }, 
        { char: "🔭", tags: "telescope astronomy explore search find" }, { char: "🎯", tags: "target goal bullseye objective focus" }, 
        { char: "🚀", tags: "rocket launch speed fast advance boost start" }, { char: "💡", tags: "lightbulb idea smart think solution inspiration" }
      ]
    },
    {
      name: "Travel",
      icon: "✈️",
      emojis: [
        { char: "✈️", tags: "airplane fly travel flight" }, { char: "🚗", tags: "car auto drive vehicle" }, 
        { char: "🚙", tags: "suv car auto vehicle" }, { char: "🛵", tags: "scooter moped drive" }, 
        { char: "🚲", tags: "bicycle bike ride cycle" }, { char: "🚂", tags: "locomotive train rail travel" }, 
        { char: "🚢", tags: "ship boat cruise travel water" }, { char: "🗺️", tags: "map world travel plan guide" }, 
        { char: "🧭", tags: "compass direction guide navigation travel orientation" }, { char: "🏢", tags: "office building company corporate work" }, 
        { char: "🏠", tags: "house home building" }, { char: "🏫", tags: "school building education university class" }, 
        { char: "🏥", tags: "hospital clinic medical sick doctor" }, { char: "🏭", tags: "factory industry manufacturing" }, 
        { char: "🏛️", tags: "museum bank government classical building" }, { char: "⛪", tags: "church building" }, 
        { char: "🌃", tags: "night sky stars city building" }, { char: "🏞️", tags: "national park nature valley" }, 
        { char: "🏜️", tags: "desert dry sand" }, { char: "🏝️", tags: "island beach palm tree travel" }, 
        { char: "🌋", tags: "volcano eruption lava hot" }
      ]
    },
    {
      name: "Symbols",
      icon: "⚽",
      emojis: [
        { char: "⚽", tags: "soccer ball sport game" }, { char: "🏀", tags: "basketball ball sport game" }, 
        { char: "🏈", tags: "football ball sport game" }, { char: "🎾", tags: "tennis racket ball sport game" }, 
        { char: "🥇", tags: "gold medal first champion win" }, { char: "🥈", tags: "silver medal second win" }, 
        { char: "🥉", tags: "bronze medal third win" }, { char: "🏆", tags: "trophy cup prize champion win first" }, 
        { char: "🎈", tags: "balloon party celebrate" }, { char: "🎉", tags: "popper party celebrate event" }, 
        { char: "⚠️", tags: "warning alert caution hazard priority" }, { char: "❗", tags: "exclamation mark alert point priority warning" }, 
        { char: "❓", tags: "question mark help info ask query" }, { char: "ℹ️", tags: "info help document details" }, 
        { char: "🔔", tags: "bell alert notification sound alarm" }, { char: "📢", tags: "loudspeaker broadcast alert announcement" }, 
        { char: "🔊", tags: "speaker sound volume loud audio" }, { char: "🔍", tags: "magnifier search glass zoom find investigate" }, 
        { char: "💬", tags: "bubble chat message talk comments discussion" }, { char: "💭", tags: "thought bubble think mind dream idea" }, 
        { char: "🟢", tags: "green circle status active safe" }, { char: "🟡", tags: "yellow circle status warning pending pause" }, 
        { char: "🔴", tags: "red circle status error alert blocked" }, { char: "🔵", tags: "blue circle status info task start" }, 
        { char: "✔️", tags: "check mark correct agree accept yes done" }, { char: "❌", tags: "cross cancel wrong reject delete block no" }, 
        { char: "🌟", tags: "sparkling star bright favorite" }, { char: "⭐", tags: "star yellow favorite rate" }, 
        { char: "⚡", tags: "lightning bolt electricity flash fast speed alert power" }, { char: "🌈", tags: "rainbow colorful dream sky" }, 
        { char: "☀️", tags: "sun warm day bright light weather summer" }, { char: "🌙", tags: "moon crescent night sky sleep" }, 
        { char: "🍀", tags: "clover leaf luck green" }, { char: "🌸", tags: "flower cherry blossom spring" }
      ]
    }
  ];
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

  let selectedCategory = $state("Smileys");
  let emojiSearchQ = $state("");
  let anyEmojiInput = $state("");
  
  const filteredEmojis = $derived.by(() => {
    const q = emojiSearchQ.trim().toLowerCase();
    if (!q) {
      return EMOJI_CATEGORIES.find(c => c.name === selectedCategory)?.emojis.map(e => e.char) ?? [];
    }
    const matches: string[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emojis) {
        if (e.tags.includes(q)) {
          matches.push(e.char);
        }
      }
    }
    return matches;
  });

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
  {#if onClose}
    <div class="panelbar">
      <span class="paneltitle">Style</span>
      <button class="panelclose" title="Collapse panel" aria-label="Collapse panel" onclick={onClose}>✕</button>
    </div>
  {/if}
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
            {#each ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as p (p)}
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
        <div class="body emoji-picker-container">
          <input
            type="text"
            class="emoji-search-input"
            placeholder="Search emojis..."
            bind:value={emojiSearchQ}
            onpointerdown={(e) => e.stopPropagation()}
          />
          
          {#if !emojiSearchQ}
            <div class="emoji-category-tabs">
              {#each EMOJI_CATEGORIES as cat}
                <button
                  class="cat-tab-btn"
                  class:active={selectedCategory === cat.name}
                  onclick={() => selectedCategory = cat.name}
                  title={cat.name}
                  type="button"
                >
                  {cat.icon}
                </button>
              {/each}
            </div>
          {/if}
          
          <div class="emojis-grid">
            {#each filteredEmojis as e (e)}
              <button title={`Insert ${e}`} onclick={() => insertEmoji(e)} type="button">{e}</button>
            {/each}
            {#if filteredEmojis.length === 0}
              <div class="no-emojis-msg">No matching emojis</div>
            {/if}
          </div>

          <div class="custom-emoji-row">
            <input
              type="text"
              class="custom-emoji-input"
              placeholder="Or paste any emoji..."
              bind:value={anyEmojiInput}
              onpointerdown={(e) => e.stopPropagation()}
            />
            <button
              class="custom-emoji-btn"
              disabled={!anyEmojiInput.trim()}
              onclick={() => { insertEmoji(anyEmojiInput.trim()); anyEmojiInput = ""; }}
              type="button"
            >
              Insert
            </button>
          </div>
          
          <div class="emoji-keyboard-tip">
            Tip: Press ⌘+Ctrl+Space (Mac) or Win+. (Win) for native emoji picker
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
  .panelbar {
    display: flex; align-items: center; justify-content: space-between;
    margin: -2px 0 6px; padding: 2px 2px 8px; border-bottom: 1px solid var(--border);
  }
  .paneltitle {
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px;
    color: var(--muted); font-weight: 700;
  }
  .panelclose {
    width: 26px; height: 26px; padding: 0; border: none; border-radius: 7px;
    background: transparent; color: var(--muted); font-size: 13px;
  }
  .panelclose:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
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

  .emoji-picker-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .emoji-search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    outline: none;
    font-size: 13px;
  }
  .emoji-search-input:focus {
    border-color: var(--accent);
  }
  .emoji-category-tabs {
    display: flex;
    justify-content: space-between;
    background: var(--surface-2);
    border-radius: 6px;
    padding: 2px;
  }
  .cat-tab-btn {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    padding: 4px 0;
    font-size: 15px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s;
  }
  .cat-tab-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  .cat-tab-btn.active {
    background: var(--panel);
    box-shadow: var(--elev-1);
  }
  .emojis-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 3px;
    max-height: 140px;
    overflow-y: auto;
    padding-right: 2px;
  }
  .emojis-grid button {
    padding: 0;
    height: 28px;
    font-size: 16px;
    border: 1px solid transparent;
    background: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .emojis-grid button:hover {
    background: var(--surface-2);
    border-color: var(--border);
  }
  .no-emojis-msg {
    grid-column: span 8;
    text-align: center;
    font-size: 12px;
    color: var(--muted);
    padding: 12px 0;
  }
  .custom-emoji-row {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .custom-emoji-input {
    flex: 1;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-1);
    color: var(--text);
    outline: none;
    font-size: 13px;
  }
  .custom-emoji-input:focus {
    border-color: var(--accent);
  }
  .custom-emoji-btn {
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .custom-emoji-btn:hover:not(:disabled) {
    background: var(--surface-3);
  }
  .custom-emoji-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .emoji-keyboard-tip {
    font-size: 10.5px;
    color: var(--muted);
    line-height: 1.3;
    margin-top: 4px;
    font-style: italic;
  }

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
