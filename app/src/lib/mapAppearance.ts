/** Shared map-level appearance defaults. Layout consumes the same settings the
 * inspector edits, so chart structure stays independent from visual treatment. */
import type { Sheet, StructureId } from '../../../src/index.js';

export const COLOR_THEMES = [
  {
    id: 'classic',
    label: 'Classic',
    root: '#33415c',
    palette: [
      '#e6584c',
      '#e98a3a',
      '#e7b93f',
      '#4fa84f',
      '#3aa6a6',
      '#3f7fd0',
      '#7a5cc9',
      '#c95ca0'
    ]
  },
  {
    id: 'ocean',
    label: 'Ocean',
    root: '#075985',
    palette: ['#0284c7', '#0ea5e9', '#06b6d4', '#14b8a6', '#2563eb', '#4f46e5']
  },
  {
    id: 'forest',
    label: 'Forest',
    root: '#166534',
    palette: ['#15803d', '#65a30d', '#16a34a', '#0f766e', '#84cc16', '#22c55e']
  },
  {
    id: 'sunset',
    label: 'Sunset',
    root: '#9a3412',
    palette: ['#ea580c', '#f97316', '#eab308', '#ef4444', '#f43f5e', '#fb7185']
  },
  {
    id: 'lavender',
    label: 'Lavender',
    root: '#5b21b6',
    palette: ['#7c3aed', '#8b5cf6', '#a855f7', '#c084fc', '#6366f1', '#4f46e5']
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    root: '#334155',
    palette: ['#334155', '#475569', '#64748b', '#1e293b', '#94a3b8', '#0f172a']
  }
] as const;

export function colorThemeFor(sheet: Sheet) {
  return COLOR_THEMES.find((theme) => theme.id === sheet.theme) ?? COLOR_THEMES[0];
}

/** Chart types the text-on-lines treatment can replace connectors in: the
 * horizontally laid-out families, which draw one connector per parent-child
 * link. Vertical and diagram layouts (org, timeline.v, fishbone, brace,
 * matrix, tree table, grid) draw their own geometry and ignore it. */
export function supportsTextOnLines(structure: StructureId): boolean {
  return (
    structure.startsWith('map.') ||
    structure.startsWith('logic.') ||
    structure.startsWith('tree.') ||
    structure === 'timeline.h'
  );
}

export function isTextOnLines(sheet: Sheet): boolean {
  // map.underline remains readable for existing documents. New documents keep
  // their own chart type and add this independent presentation on top.
  if (sheet.structure === 'map.underline') return true;
  return sheet.settings?.mapPresentation === 'underline' && supportsTextOnLines(sheet.structure);
}

/** Opt-in exception to text-on-lines: the root and its immediate branches keep
 * a filled box. Only meaningful while the treatment is on, since every topic is
 * already boxed otherwise. */
export function isBoxedLevelOne(sheet: Sheet): boolean {
  return sheet.settings?.boxedLevelOne === true && isTextOnLines(sheet);
}

export function paletteForSheet(sheet: Sheet): readonly string[] {
  const theme = colorThemeFor(sheet);
  if (sheet.settings?.coloredBranches === false) {
    return [sheet.settings.branchColor ?? theme.palette[0]];
  }
  return theme.palette;
}

export function rootColorForSheet(sheet: Sheet): string {
  return colorThemeFor(sheet).root;
}
