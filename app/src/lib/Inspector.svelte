<script lang="ts">
  import type {
    MapPresentation,
    Sheet,
    SheetSettings,
    Topic,
    TopicShape,
    StructureId
  } from '../../../src/index.js';
  import {
    COLOR_THEMES,
    isBoxedLevelOne,
    isTextOnLines,
    supportsTextOnLines
  } from './mapAppearance.js';
  import { clampTopicMinHeight, clampTopicWidth } from './layout.js';
  import {
    STRUCTURE_CATEGORIES,
    STRUCTURE_ITEMS,
    STRUCTURE_PREVIEWS,
    type StructurePreview
  } from './structurePreviews.js';

  let {
    sheet,
    topic,
    markDirty,
    onClose
  }: { sheet: Sheet; topic: Topic | null; markDirty: () => void; onClose?: () => void } = $props();

  const STRUCTURES: { id: StructureId; label: string }[] = [
    { id: 'map.balanced', label: 'Mind map · balanced' },
    { id: 'map.right', label: 'Mind map · right' },
    { id: 'map.left', label: 'Mind map · left' },
    { id: 'logic.right', label: 'Logic chart · right' },
    { id: 'logic.left', label: 'Logic chart · left' },
    { id: 'org.down', label: 'Org chart · down' },
    { id: 'org.up', label: 'Org chart · up' },
    { id: 'tree.right', label: 'Tree · right' },
    { id: 'tree.left', label: 'Tree · left' },
    { id: 'timeline.h', label: 'Timeline · horizontal' },
    { id: 'timeline.v', label: 'Timeline · vertical' },
    { id: 'fishbone.right', label: 'Fishbone · right' },
    { id: 'fishbone.left', label: 'Fishbone · left' },
    { id: 'matrix', label: 'Matrix' },
    { id: 'tree-table', label: 'Tree table' },
    { id: 'grid', label: 'Grid' },
    { id: 'brace.right', label: 'Brace map · right' },
    { id: 'brace.left', label: 'Brace map · left' }
  ];
  const SHAPES: { id: TopicShape; label: string }[] = [
    { id: 'rounded', label: 'Rounded' },
    { id: 'rect', label: 'Rectangle' },
    { id: 'capsule', label: 'Capsule' },
    { id: 'ellipse', label: 'Ellipse' },
    { id: 'underline', label: 'Underline' },
    { id: 'none', label: 'No border' }
  ];
  const PRIORITY_COLORS: Record<string, string> = {
    '1': '#e5484d',
    '2': '#e98a3a',
    '3': '#3f7fd0',
    '4': '#3aa6a6',
    '5': '#4fa84f',
    '6': '#e7b93f',
    '7': '#7a5cc9',
    '8': '#c95ca0',
    '9': '#64748b'
  };
  const MARKERS = [
    { id: 'task-start', icon: '🔵' },
    { id: 'task-25%', icon: '◔' },
    { id: 'task-50%', icon: '◑' },
    { id: 'task-75%', icon: '◕' },
    { id: 'task-done', icon: '✅' },
    { id: 'flag-red', icon: '🚩' },
    { id: 'flag-green', icon: '🏁' },
    { id: 'flag-blue', icon: '🗳️' },
    { id: 'star', icon: '⭐' },
    { id: 'star-blue', icon: '🌟' },
    { id: 'heart', icon: '❤️' },
    { id: 'idea', icon: '💡' },
    { id: 'question', icon: '❓' },
    { id: 'warning', icon: '⚠️' },
    { id: 'info', icon: 'ℹ️' },
    { id: 'cross', icon: '❌' },
    { id: 'check', icon: '✔️' },
    { id: 'rocket', icon: '🚀' },
    { id: 'fire', icon: '🔥' },
    { id: 'bomb', icon: '💣' },
    { id: 'money', icon: '💰' },
    { id: 'calendar', icon: '📅' },
    { id: 'clock', icon: '⏰' },
    { id: 'chart-up', icon: '📈' },
    { id: 'chart-down', icon: '📉' },
    { id: 'pin', icon: '📌' },
    { id: 'key', icon: '🔑' },
    { id: 'lock', icon: '🔒' },
    { id: 'people', icon: '👤' },
    { id: 'smiley', icon: '🙂' },
    { id: 'wink', icon: '😉' },
    { id: 'thumb-up', icon: '👍' },
    { id: 'thumb-down', icon: '👎' }
  ];
  const FONTS = [
    'Inter',
    'system-ui',
    'Outfit',
    'Roboto',
    'Montserrat',
    'Playfair Display',
    'Merriweather',
    'JetBrains Mono',
    'Fira Code',
    'Pacifico',
    'Dancing Script',
    'Caveat',
    'Architects Daughter',
    'Satisfy',
    'Open Sans',
    'Lato',
    'Poppins',
    'Nunito',
    'Rubik',
    'Quicksand',
    'Arial',
    'Helvetica',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Comic Sans MS',
    'Impact'
  ];
  const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];
  const BORDER_WIDTHS = [1, 1.5, 2, 3, 4];
  const LINE_WIDTHS = [1.5, 2, 2.5, 3, 4];

  const EMOJI_CATEGORIES = [
    {
      name: 'Smileys',
      icon: '😀',
      emojis: [
        { char: '😀', tags: 'smile happy grin' },
        { char: '😄', tags: 'smile happy laugh' },
        { char: '😆', tags: 'laugh squint happy' },
        { char: '😅', tags: 'sweat laugh happy' },
        { char: '😂', tags: 'joy tears laugh cry' },
        { char: '🤣', tags: 'rofl laugh floor' },
        { char: '😊', tags: 'blush smile happy' },
        { char: '😇', tags: 'angel halo innocent' },
        { char: '🙂', tags: 'slight smile' },
        { char: '🙃', tags: 'upside down' },
        { char: '😉', tags: 'wink eye' },
        { char: '😌', tags: 'relieved peace calm' },
        { char: '😍', tags: 'heart eyes love' },
        { char: '🥰', tags: 'hearts love warm' },
        { char: '😘', tags: 'kiss love blow' },
        { char: '😋', tags: 'yum tongue delicious' },
        { char: '😜', tags: 'wink tongue crazy' },
        { char: '🤪', tags: 'zany crazy wild' },
        { char: '🤨', tags: 'raised eyebrow skeptic' },
        { char: '🧐', tags: 'monocle inspector investigate' },
        { char: '🤓', tags: 'nerd geek glasses' },
        { char: '😎', tags: 'cool sunglasses glasses' },
        { char: '🥳', tags: 'party celebrate hat' },
        { char: '😏', tags: 'smirk sly' },
        { char: '😒', tags: 'unamused meh' },
        { char: '😞', tags: 'sad disappointed' },
        { char: '😔', tags: 'pensive sad' },
        { char: '😟', tags: 'worried concern' },
        { char: '😕', tags: 'confused' },
        { char: '🥺', tags: 'pleading eyes beg puppy' },
        { char: '😢', tags: 'cry sad tear' },
        { char: '😭', tags: 'sob cry heavy' },
        { char: '😤', tags: 'steam nose angry pride' },
        { char: '😠', tags: 'angry mad' },
        { char: '😡', tags: 'rage angry red' },
        { char: '🤬', tags: 'cursing mouth swear' },
        { char: '🤯', tags: 'mind blown explode shock' },
        { char: '😳', tags: 'flushed blush shock' },
        { char: '🥵', tags: 'hot red sweat summer' },
        { char: '🥶', tags: 'cold blue freeze winter' },
        { char: '😱', tags: 'scream fear gasp' },
        { char: '😴', tags: 'sleep zzz tired' },
        { char: '🤤', tags: 'drool sleep' },
        { char: '😪', tags: 'sleepy bubble' },
        { char: '🥴', tags: 'woozy dizzy' },
        { char: '🤢', tags: 'nausea green sick' },
        { char: '🤮', tags: 'vomit sick' },
        { char: '🤧', tags: 'sneeze cold nose' },
        { char: '😷', tags: 'mask sick hospital' }
      ]
    },
    {
      name: 'Gestures',
      icon: '👋',
      emojis: [
        { char: '👋', tags: 'wave hello goodbye' },
        { char: '👌', tags: 'ok correct good' },
        { char: '✌️', tags: 'victory peace hand' },
        { char: '🤞', tags: 'cross fingers luck' },
        { char: '🤟', tags: 'love sign' },
        { char: '🤘', tags: 'rock metal horns' },
        { char: '👈', tags: 'point left' },
        { char: '👉', tags: 'point right' },
        { char: '👆', tags: 'point up' },
        { char: '👇', tags: 'point down' },
        { char: '👍', tags: 'thumbs up like approve yes' },
        { char: '👎', tags: 'thumbs down dislike reject no' },
        { char: '👏', tags: 'clap hand applause' },
        { char: '🙌', tags: 'hooray celebrate raise hands' },
        { char: '👐', tags: 'open hands' },
        { char: '🤲', tags: 'palms together' },
        { char: '🤝', tags: 'handshake agree deal partnership' },
        { char: '🙏', tags: 'pray please thank you hands' },
        { char: '✍️', tags: 'write pen sign' },
        { char: '💪', tags: 'flex biceps strong power muscle' },
        { char: '🧠', tags: 'brain mind think smart intelligence' },
        { char: '🧡', tags: 'orange heart' },
        { char: '💛', tags: 'yellow heart' },
        { char: '💚', tags: 'green heart' },
        { char: '💙', tags: 'blue heart' },
        { char: '💜', tags: 'purple heart' },
        { char: '🖤', tags: 'black heart' },
        { char: '🤍', tags: 'white heart' },
        { char: '💔', tags: 'broken heart sad' },
        { char: '❤️', tags: 'red heart love' },
        { char: '🔥', tags: 'fire flame hot trend' },
        { char: '✨', tags: 'sparkles magic shiny' }
      ]
    },
    {
      name: 'Office',
      icon: '💻',
      emojis: [
        { char: '💻', tags: 'laptop computer notebook code developer' },
        { char: '🖥️', tags: 'desktop monitor screen' },
        { char: '📱', tags: 'phone mobile cell smartphone' },
        { char: '💾', tags: 'save floppy disk' },
        { char: '📁', tags: 'folder file document' },
        { char: '📂', tags: 'open folder file' },
        { char: '📄', tags: 'page document paper sheet' },
        { char: '📑', tags: 'tabs bookmark document' },
        { char: '📊', tags: 'bar chart stats metrics report' },
        { char: '📈', tags: 'chart line growth metrics trend up' },
        { char: '📉', tags: 'chart line decline decrease metrics trend down' },
        { char: '📜', tags: 'scroll history paper' },
        { char: '📋', tags: 'clipboard copy paste list' },
        { char: '📌', tags: 'pin pushpin map location board' },
        { char: '📍', tags: 'pin red map location point' },
        { char: '📎', tags: 'paperclip attach document link' },
        { char: '✉️', tags: 'envelope mail letter inbox' },
        { char: '📦', tags: 'package box delivery parcel' },
        { char: '📝', tags: 'memo note write paper editor' },
        { char: '✏️', tags: 'pencil write draw' },
        { char: '✒️', tags: 'nib pen write sign' },
        { char: '📏', tags: 'ruler scale measure' },
        { char: '📐', tags: 'triangle ruler scale geometry measure' },
        { char: '🔑', tags: 'key password secret open access' },
        { char: '🔒', tags: 'lock closed secure privacy safe' },
        { char: '🔓', tags: 'unlock open insecure access' },
        { char: '🛡️', tags: 'shield protect security safe' },
        { char: '⚙️', tags: 'gear settings configure build options' },
        { char: '🛠️', tags: 'tools hammer wrench build configure fix repair' },
        { char: '🔬', tags: 'microscope science research test' },
        { char: '🔭', tags: 'telescope astronomy explore search find' },
        { char: '🎯', tags: 'target goal bullseye objective focus' },
        { char: '🚀', tags: 'rocket launch speed fast advance boost start' },
        { char: '💡', tags: 'lightbulb idea smart think solution inspiration' }
      ]
    },
    {
      name: 'Travel',
      icon: '✈️',
      emojis: [
        { char: '✈️', tags: 'airplane fly travel flight' },
        { char: '🚗', tags: 'car auto drive vehicle' },
        { char: '🚙', tags: 'suv car auto vehicle' },
        { char: '🛵', tags: 'scooter moped drive' },
        { char: '🚲', tags: 'bicycle bike ride cycle' },
        { char: '🚂', tags: 'locomotive train rail travel' },
        { char: '🚢', tags: 'ship boat cruise travel water' },
        { char: '🗺️', tags: 'map world travel plan guide' },
        { char: '🧭', tags: 'compass direction guide navigation travel orientation' },
        { char: '🏢', tags: 'office building company corporate work' },
        { char: '🏠', tags: 'house home building' },
        { char: '🏫', tags: 'school building education university class' },
        { char: '🏥', tags: 'hospital clinic medical sick doctor' },
        { char: '🏭', tags: 'factory industry manufacturing' },
        { char: '🏛️', tags: 'museum bank government classical building' },
        { char: '⛪', tags: 'church building' },
        { char: '🌃', tags: 'night sky stars city building' },
        { char: '🏞️', tags: 'national park nature valley' },
        { char: '🏜️', tags: 'desert dry sand' },
        { char: '🏝️', tags: 'island beach palm tree travel' },
        { char: '🌋', tags: 'volcano eruption lava hot' }
      ]
    },
    {
      name: 'Symbols',
      icon: '⚽',
      emojis: [
        { char: '⚽', tags: 'soccer ball sport game' },
        { char: '🏀', tags: 'basketball ball sport game' },
        { char: '🏈', tags: 'football ball sport game' },
        { char: '🎾', tags: 'tennis racket ball sport game' },
        { char: '🥇', tags: 'gold medal first champion win' },
        { char: '🥈', tags: 'silver medal second win' },
        { char: '🥉', tags: 'bronze medal third win' },
        { char: '🏆', tags: 'trophy cup prize champion win first' },
        { char: '🎈', tags: 'balloon party celebrate' },
        { char: '🎉', tags: 'popper party celebrate event' },
        { char: '⚠️', tags: 'warning alert caution hazard priority' },
        { char: '❗', tags: 'exclamation mark alert point priority warning' },
        { char: '❓', tags: 'question mark help info ask query' },
        { char: 'ℹ️', tags: 'info help document details' },
        { char: '🔔', tags: 'bell alert notification sound alarm' },
        { char: '📢', tags: 'loudspeaker broadcast alert announcement' },
        { char: '🔊', tags: 'speaker sound volume loud audio' },
        { char: '🔍', tags: 'magnifier search glass zoom find investigate' },
        { char: '💬', tags: 'bubble chat message talk comments discussion' },
        { char: '💭', tags: 'thought bubble think mind dream idea' },
        { char: '🟢', tags: 'green circle status active safe' },
        { char: '🟡', tags: 'yellow circle status warning pending pause' },
        { char: '🔴', tags: 'red circle status error alert blocked' },
        { char: '🔵', tags: 'blue circle status info task start' },
        { char: '✔️', tags: 'check mark correct agree accept yes done' },
        { char: '❌', tags: 'cross cancel wrong reject delete block no' },
        { char: '🌟', tags: 'sparkling star bright favorite' },
        { char: '⭐', tags: 'star yellow favorite rate' },
        { char: '⚡', tags: 'lightning bolt electricity flash fast speed alert power' },
        { char: '🌈', tags: 'rainbow colorful dream sky' },
        { char: '☀️', tags: 'sun warm day bright light weather summer' },
        { char: '🌙', tags: 'moon crescent night sky sleep' },
        { char: '🍀', tags: 'clover leaf luck green' },
        { char: '🌸', tags: 'flower cherry blossom spring' }
      ]
    }
  ];
  // Quick palette matching the canvas branch colors, plus neutrals.
  const SWATCHES = [
    '#e6584c',
    '#e98a3a',
    '#e7b93f',
    '#4fa84f',
    '#3aa6a6',
    '#3f7fd0',
    '#7a5cc9',
    '#c95ca0',
    '#33415c',
    '#64748b',
    '#ffffff',
    '#1c2230'
  ];

  // --- collapsible sections (persisted) --------------------------------------
  const SECT_KEY = 'vynmm.inspector.sections';
  function loadSections(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(SECT_KEY);
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      /* fall through to defaults */
    }
    return {
      layout: true,
      style: true,
      font: true,
      markers: false,
      emoji: false,
      content: true
    };
  }
  let open = $state<Record<string, boolean>>(loadSections());
  $effect(() => {
    localStorage.setItem(SECT_KEY, JSON.stringify(open));
  });
  function toggle(id: string) {
    open[id] = !open[id];
  }

  // --- top-level tabs (persisted) --------------------------------------------
  const TAB_KEY = 'vynmm.inspector.tab';
  type TabId = 'style' | 'pitch' | 'map';
  const TABS: { id: TabId; label: string }[] = [
    { id: 'style', label: 'Style' },
    { id: 'pitch', label: 'Pitch' },
    { id: 'map', label: 'Map' }
  ];
  function loadTab(): TabId {
    const raw = localStorage.getItem(TAB_KEY);
    return raw === 'style' || raw === 'pitch' || raw === 'map' ? raw : 'map';
  }
  let activeTab = $state<TabId>(loadTab());
  $effect(() => {
    localStorage.setItem(TAB_KEY, activeTab);
  });

  const currentTheme = $derived(COLOR_THEMES.find((t) => t.id === sheet.theme) ?? COLOR_THEMES[0]);
  const structFamily = $derived((sheet.structure ?? 'map.balanced').split('.')[0]!);

  // Chart-type picker (thumbnail gallery below the card)
  let structurePickerOpen = $state(false);
  let collapsedCats = $state<Record<string, boolean>>({});
  const underlineActive = $derived(isTextOnLines(sheet));
  const boxedLevelOneActive = $derived(isBoxedLevelOne(sheet));
  function isItemActive(item: StructurePreview): boolean {
    if (sheet.structure !== item.id) return false;
    // A card is a geometry plus a treatment, so both have to match. Geometries
    // with no text-on-lines card of their own simply have no active card while
    // the treatment is on; the card falls back to naming the geometry.
    if ((item.presentation === 'underline') !== underlineActive) return false;
    if (!item.preset) return true;
    // Raw comparison: unset means the structure family's own default, which
    // differs per family (map curves, logic elbows), so unset ≠ any explicit.
    return (
      item.preset.branchStyle === sheet.settings?.branchStyle &&
      item.preset.defaultShape === sheet.settings?.defaultShape
    );
  }
  const activePreview = $derived(
    STRUCTURE_ITEMS.find(isItemActive) ?? STRUCTURE_PREVIEWS.get(sheet.structure)
  );
  const currentStructureLabel = $derived(
    activePreview?.label ??
      STRUCTURES.find((s) => s.id === sheet.structure)?.label ??
      'Mind map · underline (legacy)'
  );
  function pickStructure(item: StructurePreview) {
    setStructure(item.id);
    if (item.presentation === 'underline') setMapPresentation('underline');
    // A boxed card was chosen explicitly, so leave the underline treatment.
    else if (sheet.settings?.mapPresentation === 'underline') setMapPresentation('boxed');
    if (item.preset) {
      setBranchStyle(item.preset.branchStyle ?? '');
      setDefaultShape(item.preset.defaultShape ?? '');
    }
    structurePickerOpen = false;
  }

  let selectedCategory = $state('Smileys');
  let emojiSearchQ = $state('');
  let anyEmojiInput = $state('');

  const filteredEmojis = $derived.by(() => {
    const q = emojiSearchQ.trim().toLowerCase();
    if (!q) {
      return (
        EMOJI_CATEGORIES.find((c) => c.name === selectedCategory)?.emojis.map((e) => e.char) ?? []
      );
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
    if (!hex) return '#ffffff';
    const m = /^#?([0-9a-f]{3})$/i.exec(hex);
    if (m)
      return (
        '#' +
        m[1]!
          .split('')
          .map((c) => c + c)
          .join('')
      );
    return hex.startsWith('#') ? hex : '#' + hex;
  }

  // Mutations operate directly on the proxied topic, then flag dirty.
  function setText(v: string) {
    if (topic) {
      topic.title = v;
      markDirty();
    }
  }
  function setNodeWidth(v: string) {
    if (!topic) return;
    const n = Number(v);
    if (v === '' || !Number.isFinite(n)) delete topic.style?.width;
    else (topic.style ??= {}).width = clampTopicWidth(n);
    markDirty();
  }
  function setNodeMinHeight(v: string) {
    if (!topic) return;
    const n = Number(v);
    if (v === '' || !Number.isFinite(n)) delete topic.style?.minHeight;
    else (topic.style ??= {}).minHeight = clampTopicMinHeight(n);
    markDirty();
  }
  function resetNodeSize() {
    if (!topic?.style) return;
    delete topic.style.width;
    delete topic.style.minHeight;
    markDirty();
  }
  function setShape(v: TopicShape) {
    if (topic) {
      (topic.style ??= {}).shape = v;
      markDirty();
    }
  }
  function setFill(v: string) {
    if (topic) {
      (topic.style ??= {}).fillColor = v;
      markDirty();
    }
  }
  function clearFill() {
    if (topic?.style) {
      delete topic.style.fillColor;
      markDirty();
    }
  }
  function setBorder(v: string) {
    if (topic) {
      (topic.style ??= {}).borderColor = v;
      markDirty();
    }
  }
  function clearBorder() {
    if (topic?.style) {
      delete topic.style.borderColor;
      markDirty();
    }
  }
  function setBorderWidth(v: number) {
    if (topic) {
      (topic.style ??= {}).borderWidth = v;
      markDirty();
    }
  }
  function setLineColor(v: string) {
    if (topic) {
      (topic.style ??= {}).lineColor = v;
      markDirty();
    }
  }
  function clearLineColor() {
    if (topic?.style) {
      delete topic.style.lineColor;
      markDirty();
    }
  }
  function setLineWidth(v: number) {
    if (topic) {
      (topic.style ??= {}).lineWidth = v;
      markDirty();
    }
  }
  function setFontColor(v: string) {
    if (topic) {
      ((topic.style ??= {}).font ??= {}).color = v;
      markDirty();
    }
  }
  function clearFontColor() {
    if (topic?.style?.font) {
      delete topic.style.font.color;
      markDirty();
    }
  }
  function resetAppearance() {
    if (!topic?.style) return;
    delete topic.style.shape;
    delete topic.style.fillColor;
    delete topic.style.borderColor;
    delete topic.style.borderWidth;
    delete topic.style.lineColor;
    delete topic.style.lineWidth;
    delete topic.style.lineTaper;
    markDirty();
  }
  function toggleBold() {
    if (!topic) return;
    const font = ((topic.style ??= {}).font ??= {});
    font.weight = font.weight === 'bold' ? 'normal' : 'bold';
    markDirty();
  }
  function toggleItalic() {
    if (!topic) return;
    const font = ((topic.style ??= {}).font ??= {});
    font.style = font.style === 'italic' ? 'normal' : 'italic';
    markDirty();
  }
  function setDecoration(d: 'none' | 'underline' | 'line-through') {
    if (!topic) return;
    const font = ((topic.style ??= {}).font ??= {});
    font.decoration = font.decoration === d ? 'none' : d;
    markDirty();
  }
  function setFontFamily(v: string) {
    if (topic) {
      ((topic.style ??= {}).font ??= {}).family = v || undefined;
      markDirty();
    }
  }
  function setFontSize(v: number) {
    if (topic) {
      ((topic.style ??= {}).font ??= {}).size = v;
      markDirty();
    }
  }
  function insertEmoji(e: string) {
    if (topic) {
      topic.title = (topic.title ?? '') + e;
      markDirty();
    }
  }
  function setColorTheme(id: string) {
    sheet.theme = id;
    markDirty();
  }
  function setBackground(v: string) {
    sheet.background = { ...(sheet.background ?? {}), color: v };
    markDirty();
  }
  function setGlobalFont(v: string) {
    (sheet.settings ??= {}).globalFont = v || undefined;
    markDirty();
  }
  function setBranchLineWidth(v: string) {
    if (v === '') delete sheet.settings?.branchLineWidth;
    else (sheet.settings ??= {}).branchLineWidth = Number(v);
    markDirty();
  }
  function setColoredBranches(v: boolean) {
    (sheet.settings ??= {}).coloredBranches = v;
    markDirty();
  }
  function setBranchStyle(v: string) {
    if (v === '') delete sheet.settings?.branchStyle;
    else (sheet.settings ??= {}).branchStyle = v as 'curve' | 'straight' | 'elbow';
    markDirty();
  }
  function setDefaultShape(v: string) {
    if (v === '') delete sheet.settings?.defaultShape;
    else (sheet.settings ??= {}).defaultShape = v as TopicShape;
    markDirty();
  }
  function setBranchColor(v: string) {
    (sheet.settings ??= {}).branchColor = v;
    markDirty();
  }
  function setBoxedLevelOne(v: boolean) {
    (sheet.settings ??= {}).boxedLevelOne = v;
    markDirty();
  }
  /** Plain on/off sheet settings that need no migration or side effect. */
  function setFlag(key: keyof SheetSettings, v: boolean) {
    (sheet.settings ??= {})[key] = v;
    markDirty();
  }
  function flag(key: keyof SheetSettings): boolean {
    return sheet.settings?.[key] === true;
  }
  function setMapPresentation(v: MapPresentation) {
    (sheet.settings ??= {}).mapPresentation = v;
    // Turning the treatment off needs a migration for legacy documents: in
    // map.underline the geometry itself is the treatment.
    if (v === 'boxed' && sheet.structure === 'map.underline') {
      sheet.structure = 'map.right';
    }
    markDirty();
  }
  const font = $derived(topic?.style?.font);
  function hasMarker(id: string) {
    return topic?.markers?.includes(id) ?? false;
  }
  function toggleMarker(id: string) {
    if (!topic) return;
    const arr = (topic.markers ??= []);
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
    markDirty();
  }
  function setNote(v: string) {
    if (topic) {
      topic.note = v ? { plain: v } : null;
      markDirty();
    }
  }
  function setLink(v: string) {
    if (topic) {
      topic.hyperlink = v ? { type: 'web', value: v } : null;
      markDirty();
    }
  }
  function setLabels(v: string) {
    if (topic) {
      topic.labels = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      markDirty();
    }
  }
  function setStructure(v: string) {
    sheet.structure = v as StructureId;
    // Chart types that draw their own geometry can't show the treatment, so
    // don't leave the setting behind where it would silently do nothing.
    if (!supportsTextOnLines(sheet.structure) && sheet.settings?.mapPresentation === 'underline') {
      sheet.settings.mapPresentation = 'boxed';
    }
    markDirty();
  }

  function handleImageUpload(e: Event) {
    if (!topic) return;
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        topic.image = { resource: reader.result as string };
        markDirty();
      };
      reader.readAsDataURL(file);
    }
    input.value = ''; // reset
  }

  function removeImage() {
    if (topic?.image) {
      delete topic.image;
      markDirty();
    }
  }
</script>

{#snippet swatches(set: (c: string) => void)}
  <div class="swatches">
    {#each SWATCHES as c (c)}
      <button
        class="sw"
        style={`background:${c}`}
        title={c}
        aria-label={`Set color ${c}`}
        onclick={() => set(c)}
      ></button>
    {/each}
  </div>
{/snippet}

{#snippet toggleRow(label: string, on: boolean, set: (v: boolean) => void, disabled = false)}
  <div class="rowline">
    <span class="rowlabel">{label}</span>
    <button
      class="switch"
      class:on
      role="switch"
      aria-checked={on}
      aria-label={label}
      {disabled}
      onclick={() => set(!on)}
    ></button>
  </div>
{/snippet}

{#snippet sectionHeader(id: string, title: string)}
  <button class="sect" onclick={() => toggle(id)} aria-expanded={open[id] ?? false}>
    <span>{title}</span>
    <span class="chev" class:closed={!open[id]}>▾</span>
  </button>
{/snippet}

<aside class="inspector">
  <div class="tabbar">
    <div class="tabs" role="tablist" aria-label="Panel sections">
      {#each TABS as t (t.id)}
        <button
          class="tab"
          role="tab"
          class:active={activeTab === t.id}
          aria-selected={activeTab === t.id}
          onclick={() => (activeTab = t.id)}>{t.label}</button
        >
      {/each}
    </div>
    {#if onClose}
      <button
        class="panelclose"
        title="Collapse panel"
        aria-label="Collapse panel"
        onclick={onClose}>✕</button
      >
    {/if}
  </div>

  {#if activeTab === 'map'}
    <div class="tabbody">
      <button
        class="cardselect structbtn"
        aria-expanded={structurePickerOpen}
        onclick={() => (structurePickerOpen = !structurePickerOpen)}
      >
        <svg class="structthumb" viewBox="0 0 84 54" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
            >{@html activePreview?.svg ?? ''}</g
          >
        </svg>
        <span class="structlabel">{currentStructureLabel}</span>
        <span class="chev" class:closed={!structurePickerOpen}>▾</span>
      </button>
      {#if structurePickerOpen}
        <div class="struct-picker">
          {#each STRUCTURE_CATEGORIES as cat (cat.name)}
            <button
              class="struct-cat"
              aria-expanded={!collapsedCats[cat.name]}
              onclick={() => (collapsedCats[cat.name] = !collapsedCats[cat.name])}
            >
              <span class="chev" class:closed={collapsedCats[cat.name]}>▾</span>
              <span>{cat.name}</span>
            </button>
            {#if !collapsedCats[cat.name]}
              <div class="struct-grid">
                {#each cat.items as item (item.key ?? item.id)}
                  <button
                    class="scard"
                    class:on={isItemActive(item)}
                    title={item.label}
                    aria-label={item.label}
                    onclick={() => pickStructure(item)}
                  >
                    <svg viewBox="0 0 84 54" aria-hidden="true">
                      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                        >{@html item.svg}</g
                      >
                    </svg>
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        </div>
      {/if}

      <div class="groupname">Color Theme</div>
      <div class="theme-dropdown">
        <span
          class="strip"
          style={`background:linear-gradient(90deg, ${currentTheme.palette.join(',')})`}
        ></span>
        <select
          class="cardinput"
          value={sheet.theme ?? currentTheme.id}
          onchange={(e) => setColorTheme(e.currentTarget.value)}
        >
          {#each COLOR_THEMES as theme (theme.id)}<option value={theme.id}>{theme.label}</option
            >{/each}
        </select>
      </div>
      <div class="theme-grid">
        {#each COLOR_THEMES as theme (theme.id)}
          <button
            class="tcard"
            class:on={(sheet.theme ?? COLOR_THEMES[0].id) === theme.id}
            title={`${theme.label} color theme`}
            aria-label={`${theme.label} color theme`}
            onclick={() => setColorTheme(theme.id)}
          >
            <svg viewBox="0 0 84 54" aria-hidden="true">
              <rect x="5" y="22" width="25" height="11" rx="3" fill={theme.root} />
              {#each theme.palette.slice(0, 5) as c, i (i)}
                <path
                  d={`M30 27 C 44 27, 42 ${9 + i * 9.5}, 54 ${9 + i * 9.5}`}
                  stroke={c}
                  fill="none"
                  stroke-width="1.5"
                />
                <rect x="54" y={9 + i * 9.5 - 2.2} width="24" height="4.4" rx="2.2" fill={c} />
              {/each}
            </svg>
          </button>
        {/each}
      </div>

      <div class="map-divider"></div>
      <div class="rowline">
        <span class="rowlabel">Background Color</span>
        <input
          type="color"
          value={expand(sheet.background?.color ?? '#f5f6f8')}
          oninput={(e) => setBackground(e.currentTarget.value)}
        />
      </div>

      <label class="stack"
        >Global Font
        <select
          value={sheet.settings?.globalFont ?? ''}
          onchange={(e) => setGlobalFont(e.currentTarget.value)}
        >
          <option value="">Default</option>
          {#each FONTS as fontName (fontName)}<option value={fontName}>{fontName}</option>{/each}
        </select>
      </label>
      <label class="stack"
        >Branch Line Width
        <select
          value={sheet.settings?.branchLineWidth ?? ''}
          onchange={(e) => setBranchLineWidth(e.currentTarget.value)}
        >
          <option value="">Default</option>
          {#each LINE_WIDTHS as width (width)}<option value={width}>{width} px</option>{/each}
        </select>
      </label>
      <label class="stack"
        >Branch Style
        <select
          value={sheet.settings?.branchStyle ?? ''}
          onchange={(e) => setBranchStyle(e.currentTarget.value)}
        >
          <option value="">Default</option>
          <option value="curve">Curved</option>
          <option value="straight">Straight</option>
          <option value="elbow">Elbow</option>
        </select>
      </label>
      <label class="stack"
        >Default Topic Shape
        <select
          value={sheet.settings?.defaultShape ?? ''}
          onchange={(e) => setDefaultShape(e.currentTarget.value)}
        >
          <option value="">Rounded (default)</option>
          {#each SHAPES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
        </select>
      </label>

      <div class="rowline">
        <label class="checkline">
          <input
            type="checkbox"
            checked={sheet.settings?.coloredBranches !== false}
            onchange={(e) => setColoredBranches(e.currentTarget.checked)}
          />
          <span>Colored Branch</span>
        </label>
        {#if sheet.settings?.coloredBranches === false}
          <input
            type="color"
            title="Branch color"
            value={expand(sheet.settings?.branchColor ?? '#4f46d4')}
            oninput={(e) => setBranchColor(e.currentTarget.value)}
          />
        {:else}
          <span
            class="rainbow-chip"
            title="Branches use the color theme"
            style={`background:conic-gradient(${currentTheme.palette.join(',')},${currentTheme.palette[0]})`}
          ></span>
        {/if}
      </div>

      <div class="map-divider"></div>
      <div class="groupname strong">Map Style</div>
      <div class="rowline">
        <span class="rowlabel">Balance Map</span>
        <button
          class="switch"
          class:on={sheet.structure === 'map.balanced'}
          role="switch"
          aria-checked={sheet.structure === 'map.balanced'}
          aria-label="Balance map"
          disabled={structFamily !== 'map'}
          onclick={() =>
            setStructure(sheet.structure === 'map.balanced' ? 'map.right' : 'map.balanced')}
        ></button>
      </div>
      {@render toggleRow(
        'Text on Lines',
        underlineActive,
        (v) => setMapPresentation(v ? 'underline' : 'boxed'),
        !supportsTextOnLines(sheet.structure)
      )}
      {@render toggleRow(
        'Boxed First Level',
        boxedLevelOneActive,
        setBoxedLevelOne,
        !underlineActive
      )}
      {@render toggleRow('Compact Map', flag('compactMap'), (v) => setFlag('compactMap', v))}

      <div class="map-divider"></div>
      <div class="groupname strong">Topic Display</div>
      {@render toggleRow('Uniform Topic Length', flag('uniformTopicLength'), (v) =>
        setFlag('uniformTopicLength', v)
      )}
      {@render toggleRow('Display All Notes', flag('displayAllNotes'), (v) =>
        setFlag('displayAllNotes', v)
      )}
      {@render toggleRow('Auto-colour Floating Topic', flag('autoColorFloating'), (v) =>
        setFlag('autoColorFloating', v)
      )}

      <div class="map-divider"></div>
      <div class="groupname strong">Relationship</div>
      {@render toggleRow('Line Colour Follow Topic', flag('relationLineFollowTopic'), (v) =>
        setFlag('relationLineFollowTopic', v)
      )}

      <div class="map-divider"></div>
      <div class="groupname strong">Advanced</div>
      {@render toggleRow('Free Branch Position', flag('freeBranchPosition'), (v) =>
        setFlag('freeBranchPosition', v)
      )}
      <p class="hint">
        Dragging a branch to empty space moves it there and keeps its connector, instead of
        detaching it into a floating topic.
      </p>
    </div>
  {:else if activeTab === 'pitch'}
    <div class="tabbody">
      <p class="hint">
        Pitch mode settings are coming soon. Use the presentation button in the toolbar to present
        this map.
      </p>
    </div>
  {:else if topic}
    <section>
      {@render sectionHeader('layout', 'Size & wrapping')}
      {#if open.layout}
        <div class="body">
          <p class="hint">
            Leave width empty for automatic sizing. A fixed width controls where the title wraps.
          </p>
          <div class="row">
            <label class="col"
              >Width
              <input
                type="number"
                min="56"
                max="800"
                step="4"
                placeholder="Auto"
                value={topic.style?.width ?? ''}
                oninput={(e) => setNodeWidth(e.currentTarget.value)}
              />
            </label>
            <label class="col"
              >Min height
              <input
                type="number"
                min="34"
                step="4"
                placeholder="Auto"
                value={topic.style?.minHeight ?? ''}
                oninput={(e) => setNodeMinHeight(e.currentTarget.value)}
              />
            </label>
          </div>
          <button class="reset" onclick={resetNodeSize}>Auto size</button>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader('style', 'Appearance')}
      {#if open.style}
        <div class="body">
          <label
            >Text
            <textarea rows="2" value={topic.title} oninput={(e) => setText(e.currentTarget.value)}
            ></textarea>
          </label>

          <label
            >Shape
            <select
              value={topic.style?.shape ?? 'rounded'}
              onchange={(e) => setShape(e.currentTarget.value as TopicShape)}
            >
              {#each SHAPES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
            </select>
          </label>

          <div class="fieldname">Fill</div>
          {@render swatches(setFill)}
          <div class="colorline">
            <input
              type="color"
              value={expand(topic.style?.fillColor)}
              oninput={(e) => setFill(e.currentTarget.value)}
            />
            <button class="link" onclick={clearFill}>auto</button>
          </div>

          <div class="fieldname">Border</div>
          {@render swatches(setBorder)}
          <div class="colorline">
            <input
              type="color"
              value={expand(topic.style?.borderColor)}
              oninput={(e) => setBorder(e.currentTarget.value)}
            />
            <select
              class="mini"
              value={topic.style?.borderWidth ?? 1.5}
              onchange={(e) => setBorderWidth(Number(e.currentTarget.value))}
              title="Border width"
            >
              {#each BORDER_WIDTHS as w (w)}<option value={w}>{w} px</option>{/each}
            </select>
            <button class="link" onclick={clearBorder}>auto</button>
          </div>

          <div class="fieldname">Branch line (to children)</div>
          <div class="colorline">
            <input
              type="color"
              value={expand(topic.style?.lineColor)}
              oninput={(e) => setLineColor(e.currentTarget.value)}
            />
            <select
              class="mini"
              value={topic.style?.lineWidth ?? 2.5}
              onchange={(e) => setLineWidth(Number(e.currentTarget.value))}
              title="Branch line width"
            >
              {#each LINE_WIDTHS as w (w)}<option value={w}>{w} px</option>{/each}
            </select>
            <button class="link" onclick={clearLineColor}>auto</button>
          </div>

          <button class="reset" onclick={resetAppearance}>Reset appearance</button>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader('font', 'Font')}
      {#if open.font}
        <div class="body">
          <div class="row">
            <label class="col"
              >Family
              <select
                value={font?.family ?? 'Inter'}
                onchange={(e) => setFontFamily(e.currentTarget.value)}
              >
                {#each FONTS as f (f)}<option value={f}>{f}</option>{/each}
              </select>
            </label>
            <label style="width:64px"
              >Size
              <select
                value={font?.size ?? 13}
                onchange={(e) => setFontSize(Number(e.currentTarget.value))}
              >
                {#each FONT_SIZES as s (s)}<option value={s}>{s}</option>{/each}
              </select>
            </label>
          </div>
          <div class="fieldname">Text color</div>
          {@render swatches(setFontColor)}
          <div class="colorline">
            <input
              type="color"
              value={expand(topic.style?.font?.color)}
              oninput={(e) => setFontColor(e.currentTarget.value)}
            />
            <button class="link" onclick={clearFontColor}>auto</button>
            <div class="fontbtns">
              <button
                class="ff bold"
                class:on={font?.weight === 'bold'}
                title="Bold"
                onclick={toggleBold}>B</button
              >
              <button
                class="ff ital"
                class:on={font?.style === 'italic'}
                title="Italic"
                onclick={toggleItalic}>I</button
              >
              <button
                class="ff und"
                class:on={font?.decoration === 'underline'}
                title="Underline"
                onclick={() => setDecoration('underline')}>U</button
              >
              <button
                class="ff strike"
                class:on={font?.decoration === 'line-through'}
                title="Strikethrough"
                onclick={() => setDecoration('line-through')}>S</button
              >
            </div>
          </div>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader('markers', 'Markers')}
      {#if open.markers}
        <div class="body">
          <div class="fieldname">Priority</div>
          <div class="markers">
            {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as p (p)}
              <button
                class="prio"
                class:on={hasMarker(`priority-${p}`)}
                title={`Priority ${p}`}
                style={`--pc:${PRIORITY_COLORS[p]}`}
                onclick={() => toggleMarker(`priority-${p}`)}
              >
                <span>{p}</span>
              </button>
            {/each}
          </div>
          <div class="fieldname">Progress &amp; symbols</div>
          <div class="markers">
            {#each MARKERS as m (m.id)}
              <button class:on={hasMarker(m.id)} title={m.id} onclick={() => toggleMarker(m.id)}
                >{m.icon}</button
              >
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <section>
      {@render sectionHeader('emoji', 'Insert emoji')}
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
                  onclick={() => (selectedCategory = cat.name)}
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
              <button title={`Insert ${e}`} onclick={() => insertEmoji(e)} type="button">{e}</button
              >
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
              onclick={() => {
                insertEmoji(anyEmojiInput.trim());
                anyEmojiInput = '';
              }}
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
      {@render sectionHeader('content', 'Note · link · labels · image')}
      {#if open.content}
        <div class="body">
          <label
            >Note
            <textarea
              rows="3"
              value={topic.note?.plain ?? ''}
              oninput={(e) => setNote(e.currentTarget.value)}></textarea>
          </label>
          <label
            >Link
            <input
              type="url"
              placeholder="https://…"
              value={topic.hyperlink?.value ?? ''}
              oninput={(e) => setLink(e.currentTarget.value)}
            />
          </label>
          <label
            >Labels (comma-separated)
            <input
              value={topic.labels?.join(', ') ?? ''}
              oninput={(e) => setLabels(e.currentTarget.value)}
            />
          </label>
          <div class="fieldname">Image Attachment</div>
          <div class="image-upload-row">
            <input type="file" accept="image/*" onchange={handleImageUpload} class="file-input" />
            {#if topic.image}
              <button class="remove-img-btn" onclick={removeImage}>Remove Image</button>
            {/if}
          </div>
        </div>
      {/if}
    </section>
  {:else}
    <p class="hint">Select a topic to edit its style, markers, note, and link.</p>
  {/if}
</aside>

<style>
  .inspector {
    width: 300px;
    flex: none;
    height: 100%;
    overflow-y: auto;
    background: var(--panel);
    border-left: 1px solid var(--border);
    box-shadow: var(--elev-1);
    padding: 10px;
    font-size: 13px;
  }

  /* Top-level Style / Pitch / Map tabs */
  .tabbar {
    position: sticky;
    top: -10px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 4px;
    margin: -10px -10px 10px;
    padding: 6px 8px 0;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  .tabs {
    display: flex;
    flex: 1;
    justify-content: space-evenly;
  }
  .tab {
    position: relative;
    border: none;
    background: transparent;
    padding: 8px 14px 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    border-radius: 0;
  }
  .tab:hover:not(:disabled) {
    color: var(--text);
  }
  .tab.active {
    color: var(--text);
  }
  .tab.active::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: -1px;
    height: 2.5px;
    border-radius: 2px;
    background: var(--text);
  }
  .tabbody {
    padding: 2px 2px 8px;
  }

  /* Chart-type card + theme dropdown */
  .cardselect,
  .theme-dropdown {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    margin-bottom: 8px;
  }
  .cardselect {
    padding: 14px 12px;
  }
  .cardselect:focus-within,
  .theme-dropdown:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .structthumb {
    width: 66px;
    height: auto;
    flex: none;
    color: color-mix(in srgb, var(--text) 72%, transparent);
    background: color-mix(in srgb, var(--text) 3%, var(--panel));
    border: 1px solid var(--border);
    border-radius: 7px;
  }
  .cardinput {
    flex: 1;
    min-width: 0;
    margin: 0 !important;
    padding: 4px 2px !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    font-size: 13.5px;
    font-weight: 600;
  }
  .strip {
    width: 56px;
    height: 14px;
    flex: none;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  }

  /* Chart-type picker gallery */
  .structbtn {
    width: 100%;
    text-align: left;
    color: var(--text);
  }
  .structbtn:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }
  .structlabel {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .struct-picker {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    padding: 4px 8px 10px;
    margin-bottom: 8px;
    max-height: 380px;
    overflow-y: auto;
  }
  .struct-cat {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    border: none;
    background: transparent;
    padding: 8px 2px 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text);
    text-align: left;
  }
  .struct-cat:hover:not(:disabled) {
    color: var(--accent);
  }
  .struct-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
    margin-bottom: 4px;
  }
  .scard {
    padding: 4px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: color-mix(in srgb, var(--text) 72%, transparent);
  }
  .scard svg {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
    background: color-mix(in srgb, var(--text) 3%, var(--panel));
  }
  .scard:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
    color: var(--text);
  }
  .scard.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
    color: var(--text);
  }

  .groupname {
    color: var(--muted);
    font-size: 12px;
    margin: 14px 0 7px;
  }
  .groupname.strong {
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
  }

  /* Theme preview cards */
  .theme-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }
  .tcard {
    padding: 5px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--panel);
  }
  .tcard svg {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 6px;
    background: color-mix(in srgb, var(--text) 3%, var(--panel));
  }
  .tcard:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  }
  .tcard.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
  }

  /* Label-left / control-right rows */
  .rowline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 12px 0;
  }
  .rowlabel {
    color: var(--text);
    font-size: 13px;
  }
  .stack {
    color: var(--muted);
  }
  .rainbow-chip {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
  }

  /* Toggle switch */
  .switch {
    position: relative;
    width: 38px;
    height: 22px;
    flex: none;
    padding: 0;
    border: none;
    border-radius: 11px;
    background: color-mix(in srgb, var(--text) 18%, var(--panel));
    transition: background 0.15s ease;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.15s ease;
  }
  .switch.on {
    background: var(--accent);
  }
  .switch.on::after {
    transform: translateX(16px);
  }
  .switch:disabled {
    opacity: 0.4;
  }

  .panelclose {
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
  }
  .panelclose:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--text);
  }
  section {
    margin-bottom: 6px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 6px;
  }
  section:last-of-type {
    border-bottom: none;
  }

  /* Collapsible section header */
  .sect {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    border: none;
    border-radius: 8px;
    background: transparent;
    padding: 8px 8px;
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--accent);
    font-weight: 700;
    text-align: left;
  }
  .sect:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .chev {
    font-size: 11px;
    color: var(--muted);
    transition: transform 0.12s ease;
  }
  .chev.closed {
    transform: rotate(-90deg);
  }
  .body {
    padding: 4px 6px 8px;
  }

  .fieldname {
    color: var(--muted);
    font-size: 12px;
    margin: 10px 0 5px;
  }
  label {
    display: block;
    margin-bottom: 11px;
    color: var(--muted);
    font-size: 12px;
  }
  textarea,
  select,
  input[type='url'],
  input:not([type]) {
    width: 100%;
    margin-top: 4px;
    padding: 7px 9px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font: inherit;
    color: var(--text);
    background: var(--panel);
    resize: vertical;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  textarea:focus,
  select:focus,
  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .col {
    flex: 1;
  }

  /* Quick color palette */
  .swatches {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 4px;
    margin-bottom: 6px;
  }
  .sw {
    aspect-ratio: 1;
    width: 100%;
    padding: 0;
    border-radius: 5px;
    border: 1px solid color-mix(in srgb, var(--text) 18%, transparent);
  }
  .sw:hover:not(:disabled) {
    transform: scale(1.15);
    box-shadow: var(--elev-1);
  }

  .colorline {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .colorline input:not([type='color']) {
    flex: 1;
    min-width: 0;
  }
  .map-divider {
    height: 1px;
    margin: 14px 0;
    background: var(--border);
  }
  .checkline {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--text);
    font-size: 13px;
  }
  .checkline input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
  }
  input[type='color'] {
    width: 44px;
    height: 28px;
    padding: 0;
    flex: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--panel);
  }
  select.mini {
    width: auto;
    flex: 1;
    margin-top: 0;
    padding: 5px 6px;
    font-size: 12px;
  }
  .link {
    border: none;
    background: none;
    color: var(--accent);
    padding: 0 2px;
    font-size: 12px;
    flex: none;
  }
  .reset {
    width: 100%;
    margin-top: 10px;
    padding: 6px 10px;
    font-size: 12px;
    border-radius: 8px;
    color: var(--muted);
  }
  .reset:hover:not(:disabled) {
    color: #c0392b;
    border-color: #c0392b;
    background: color-mix(in srgb, #c0392b 6%, var(--panel));
  }

  .image-upload-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }
  .file-input {
    font-size: 11px;
    color: var(--muted);
    border: 1px dashed var(--border);
    border-radius: 6px;
    padding: 8px;
    background: var(--surface-1);
    cursor: pointer;
  }
  .file-input::file-selector-button {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    padding: 4px 8px;
    margin-right: 8px;
    cursor: pointer;
    font-size: 11px;
  }
  .file-input::file-selector-button:hover {
    background: var(--surface-3);
  }
  .remove-img-btn {
    padding: 6px 10px;
    font-size: 12px;
    border-radius: 6px;
    color: #c0392b;
    border: 1px solid color-mix(in srgb, #c0392b 20%, transparent);
    background: color-mix(in srgb, #c0392b 6%, var(--panel));
    cursor: pointer;
  }
  .remove-img-btn:hover {
    background: color-mix(in srgb, #c0392b 12%, var(--panel));
  }

  .fontbtns {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }
  .ff {
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 7px;
  }
  .ff.bold {
    font-weight: 700;
  }
  .ff.ital {
    font-style: italic;
    font-family: Georgia, serif;
  }
  .ff.und {
    text-decoration: underline;
  }
  .ff.strike {
    text-decoration: line-through;
  }
  .ff.on {
    background: var(--accent);
    color: var(--md-on-primary);
    border-color: var(--accent);
  }

  .markers {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .markers button {
    width: 30px;
    height: 30px;
    padding: 0;
    font-size: 14px;
    border-radius: 8px;
  }
  .markers button.on {
    background: color-mix(in srgb, var(--accent) 20%, var(--panel));
    border-color: var(--accent);
  }
  .prio span {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--pc);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
  }
  .prio.on {
    border-color: var(--pc);
    background: color-mix(in srgb, var(--pc) 14%, var(--panel));
  }

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
    transition:
      background 0.15s,
      border-color 0.15s;
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

  .hint {
    color: var(--muted);
    padding: 6px;
  }
</style>
