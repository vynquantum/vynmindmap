<script lang="ts" module>
  // Lucide-style 24×24 stroke icons (MIT). Each entry is the inner SVG markup.
  export const ICONS: Record<string, string> = {
    "file-plus": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/>',
    "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H21a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    "save-as": '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h7"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    markdown: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 15V9l3 3 3-3v6"/><path d="M17 9v4"/><path d="M15 13l2 2 2-2"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    sitemap: '<rect width="8" height="6" x="8" y="2" rx="1"/><rect width="6" height="5" x="2" y="16" rx="1"/><rect width="6" height="5" x="16" y="16" rx="1"/><path d="M12 8v4"/><path d="M5 16v-1a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1"/>',
  };
</script>

<script lang="ts">
  let { name, size = 18, stroke = 2 }: { name: string; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size} height={size} viewBox="0 0 24 24"
  fill="none" stroke="currentColor" stroke-width={stroke}
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html ICONS[name] ?? ""}
</svg>
