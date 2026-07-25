/** Line-drawing thumbnails for the chart-type picker, one per structure.
 * SVG fragments render inside a `<g fill="none" stroke="currentColor">` on an
 * 84×54 viewBox; filled bars opt out of the inherited stroke explicitly. */
import type { MapPresentation, SheetSettings, StructureId } from '../../../src/index.js';

const bar = (x: number, y: number, w = 13) =>
  `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2.5" fill="currentColor" opacity=".25" stroke="none"/>`;

export interface StructurePreview {
  id: StructureId;
  /** Distinguishes cards that share a structure but differ in presentation. */
  key?: string;
  label: string;
  svg: string;
  presentation?: MapPresentation;
  /** Style bundle the card applies; unset fields reset to their defaults. */
  preset?: Pick<SheetSettings, 'branchStyle' | 'defaultShape'>;
}

export interface StructureCategory {
  name: string;
  items: StructurePreview[];
}

export const STRUCTURE_CATEGORIES: StructureCategory[] = [
  {
    name: 'Mind Map',
    items: [
      {
        id: 'map.balanced',
        label: 'Mind map · balanced',
        preset: {},
        svg:
          '<rect x="31" y="21" width="22" height="12" rx="3.5"/>' +
          '<path d="M53 27 C60 27 60 12 66 12"/><path d="M53 27h13"/><path d="M53 27 C60 27 60 42 66 42"/>' +
          bar(66, 9.5) +
          bar(66, 24.5) +
          bar(66, 39.5) +
          '<path d="M31 27 C24 27 24 12 18 12"/><path d="M18 27h13"/><path d="M31 27 C24 27 24 42 18 42"/>' +
          bar(5, 9.5) +
          bar(5, 24.5) +
          bar(5, 39.5)
      },
      {
        id: 'map.right',
        label: 'Mind map · right',
        preset: {},
        svg:
          '<rect x="6" y="21" width="22" height="12" rx="3.5"/>' +
          '<path d="M28 27 C42 27 42 8 56 8"/><path d="M28 27 C42 27 42 20 56 20"/>' +
          '<path d="M28 27 C42 27 42 34 56 34"/><path d="M28 27 C42 27 42 46 56 46"/>' +
          bar(56, 5.5, 20) +
          bar(56, 17.5, 20) +
          bar(56, 31.5, 20) +
          bar(56, 43.5, 20)
      },
      {
        id: 'map.left',
        label: 'Mind map · left',
        preset: {},
        svg:
          '<rect x="56" y="21" width="22" height="12" rx="3.5"/>' +
          '<path d="M56 27 C42 27 42 8 28 8"/><path d="M56 27 C42 27 42 20 28 20"/>' +
          '<path d="M56 27 C42 27 42 34 28 34"/><path d="M56 27 C42 27 42 46 28 46"/>' +
          bar(8, 5.5, 20) +
          bar(8, 17.5, 20) +
          bar(8, 31.5, 20) +
          bar(8, 43.5, 20)
      },
      {
        id: 'map.right',
        key: 'map.text-on-lines',
        label: 'Mind map · text on lines',
        presentation: 'underline',
        svg:
          bar(8, 20, 18) +
          '<path d="M6 27h24"/>' +
          '<path d="M30 27 C42 27 42 10 52 10 H78"/>' +
          bar(56, 3, 16) +
          '<path d="M30 27 H78"/>' +
          bar(56, 20, 16) +
          '<path d="M30 27 C42 27 42 44 52 44 H78"/>' +
          bar(56, 37, 16)
      },
      {
        id: 'map.balanced',
        key: 'map.capsule',
        label: 'Mind map · capsule',
        preset: { defaultShape: 'capsule' },
        svg:
          '<rect x="31" y="21" width="22" height="12" rx="6"/>' +
          '<path d="M53 27 C60 27 60 12 66 12"/><path d="M53 27h13"/><path d="M53 27 C60 27 60 42 66 42"/>' +
          '<rect x="66" y="8" width="14" height="8" rx="4"/>' +
          '<rect x="66" y="23" width="14" height="8" rx="4"/>' +
          '<rect x="66" y="38" width="14" height="8" rx="4"/>' +
          '<path d="M31 27 C24 27 24 12 18 12"/><path d="M18 27h13"/><path d="M31 27 C24 27 24 42 18 42"/>' +
          '<rect x="4" y="8" width="14" height="8" rx="4"/>' +
          '<rect x="4" y="23" width="14" height="8" rx="4"/>' +
          '<rect x="4" y="38" width="14" height="8" rx="4"/>'
      },
      {
        id: 'map.balanced',
        key: 'map.straight',
        label: 'Mind map · straight lines',
        preset: { branchStyle: 'straight' },
        svg:
          '<rect x="31" y="21" width="22" height="12" rx="3.5"/>' +
          '<path d="M53 27 66 12"/><path d="M53 27h13"/><path d="M53 27 66 42"/>' +
          bar(66, 9.5) +
          bar(66, 24.5) +
          bar(66, 39.5) +
          '<path d="M31 27 18 12"/><path d="M18 27h13"/><path d="M31 27 18 42"/>' +
          bar(5, 9.5) +
          bar(5, 24.5) +
          bar(5, 39.5)
      },
      {
        id: 'map.balanced',
        key: 'map.elbow',
        label: 'Mind map · elbow',
        preset: { branchStyle: 'elbow' },
        svg:
          '<rect x="31" y="21" width="22" height="12" rx="3.5"/>' +
          '<path d="M53 27 H60 V12 H66"/><path d="M53 27h13"/><path d="M53 27 H60 V42 H66"/>' +
          bar(66, 9.5) +
          bar(66, 24.5) +
          bar(66, 39.5) +
          '<path d="M31 27 H24 V12 H18"/><path d="M18 27h13"/><path d="M31 27 H24 V42 H18"/>' +
          bar(5, 9.5) +
          bar(5, 24.5) +
          bar(5, 39.5)
      }
    ]
  },
  {
    name: 'Logic Chart',
    items: [
      {
        id: 'logic.right',
        label: 'Logic chart · right',
        preset: {},
        svg:
          '<rect x="4" y="22" width="20" height="10" rx="3"/>' +
          '<path d="M24 27h8"/><path d="M32 10v34"/><path d="M32 10h8"/><path d="M32 27h8"/><path d="M32 44h8"/>' +
          bar(40, 7.5, 20) +
          bar(40, 24.5, 20) +
          bar(40, 41.5, 20)
      },
      {
        id: 'logic.left',
        label: 'Logic chart · left',
        preset: {},
        svg:
          '<rect x="60" y="22" width="20" height="10" rx="3"/>' +
          '<path d="M60 27h-8"/><path d="M52 10v34"/><path d="M52 10h-8"/><path d="M52 27h-8"/><path d="M52 44h-8"/>' +
          bar(24, 7.5, 20) +
          bar(24, 24.5, 20) +
          bar(24, 41.5, 20)
      },
      {
        id: 'logic.right',
        key: 'logic.curved',
        label: 'Logic chart · curved',
        preset: { branchStyle: 'curve' },
        svg:
          '<rect x="4" y="22" width="20" height="10" rx="3"/>' +
          '<path d="M24 27 C34 27 34 10 40 10"/><path d="M24 27h16"/><path d="M24 27 C34 27 34 44 40 44"/>' +
          bar(40, 7.5, 20) +
          bar(40, 24.5, 20) +
          bar(40, 41.5, 20)
      },
      {
        id: 'logic.right',
        key: 'logic.capsule',
        label: 'Logic chart · capsule',
        preset: { defaultShape: 'capsule' },
        svg:
          '<rect x="4" y="22" width="20" height="10" rx="5"/>' +
          '<path d="M24 27h8"/><path d="M32 10v34"/><path d="M32 10h8"/><path d="M32 27h8"/><path d="M32 44h8"/>' +
          '<rect x="40" y="5.5" width="20" height="9" rx="4.5"/>' +
          '<rect x="40" y="22.5" width="20" height="9" rx="4.5"/>' +
          '<rect x="40" y="39.5" width="20" height="9" rx="4.5"/>'
      }
    ]
  },
  {
    name: 'Org Chart',
    items: [
      {
        id: 'org.down',
        label: 'Org chart · down',
        preset: {},
        svg:
          '<rect x="32" y="6" width="20" height="10" rx="3"/>' +
          '<path d="M42 16v6"/><path d="M16 22h52"/><path d="M16 22v6"/><path d="M42 22v6"/><path d="M68 22v6"/>' +
          '<rect x="6" y="28" width="20" height="10" rx="3"/><rect x="32" y="28" width="20" height="10" rx="3"/><rect x="58" y="28" width="20" height="10" rx="3"/>' +
          bar(9.5, 43) +
          bar(35.5, 43) +
          bar(61.5, 43)
      },
      {
        id: 'org.up',
        label: 'Org chart · up',
        preset: {},
        svg:
          '<rect x="32" y="38" width="20" height="10" rx="3"/>' +
          '<path d="M42 38v-6"/><path d="M16 32h52"/><path d="M16 32v-6"/><path d="M42 32v-6"/><path d="M68 32v-6"/>' +
          '<rect x="6" y="16" width="20" height="10" rx="3"/><rect x="32" y="16" width="20" height="10" rx="3"/><rect x="58" y="16" width="20" height="10" rx="3"/>' +
          bar(9.5, 6) +
          bar(35.5, 6) +
          bar(61.5, 6)
      },
      {
        id: 'org.down',
        key: 'org.straight',
        label: 'Org chart · straight',
        preset: { branchStyle: 'straight' },
        svg:
          '<rect x="32" y="6" width="20" height="10" rx="3"/>' +
          '<path d="M42 16 16 28"/><path d="M42 16v12"/><path d="M42 16 68 28"/>' +
          '<rect x="6" y="28" width="20" height="10" rx="3"/><rect x="32" y="28" width="20" height="10" rx="3"/><rect x="58" y="28" width="20" height="10" rx="3"/>' +
          bar(9.5, 43) +
          bar(35.5, 43) +
          bar(61.5, 43)
      },
      {
        id: 'org.down',
        key: 'org.capsule',
        label: 'Org chart · capsule',
        preset: { defaultShape: 'capsule' },
        svg:
          '<rect x="32" y="6" width="20" height="10" rx="5"/>' +
          '<path d="M42 16v6"/><path d="M16 22h52"/><path d="M16 22v6"/><path d="M42 22v6"/><path d="M68 22v6"/>' +
          '<rect x="6" y="28" width="20" height="10" rx="5"/><rect x="32" y="28" width="20" height="10" rx="5"/><rect x="58" y="28" width="20" height="10" rx="5"/>' +
          bar(9.5, 43) +
          bar(35.5, 43) +
          bar(61.5, 43)
      }
    ]
  },
  {
    name: 'Tree Chart',
    items: [
      {
        id: 'tree.right',
        label: 'Tree · right',
        preset: {},
        svg:
          '<rect x="6" y="5" width="24" height="11" rx="3"/>' +
          '<path d="M12 16v30"/><path d="M12 26h8"/><path d="M12 36h8"/><path d="M12 46h8"/>' +
          bar(20, 23.5, 22) +
          bar(20, 33.5, 22) +
          bar(20, 43.5, 22)
      },
      {
        id: 'tree.left',
        label: 'Tree · left',
        preset: {},
        svg:
          '<rect x="54" y="5" width="24" height="11" rx="3"/>' +
          '<path d="M72 16v30"/><path d="M72 26h-8"/><path d="M72 36h-8"/><path d="M72 46h-8"/>' +
          bar(42, 23.5, 22) +
          bar(42, 33.5, 22) +
          bar(42, 43.5, 22)
      },
      {
        id: 'tree.right',
        key: 'tree.curved',
        label: 'Tree · curved',
        preset: { branchStyle: 'curve' },
        svg:
          '<rect x="6" y="5" width="24" height="11" rx="3"/>' +
          '<path d="M12 16 C12 24 14 26 20 26"/><path d="M12 16 C12 34 14 36 20 36"/><path d="M12 16 C12 44 14 46 20 46"/>' +
          bar(20, 23.5, 22) +
          bar(20, 33.5, 22) +
          bar(20, 43.5, 22)
      }
    ]
  },
  {
    name: 'Timeline',
    items: [
      {
        id: 'timeline.h',
        label: 'Timeline · horizontal',
        preset: {},
        svg:
          '<path d="M6 32h72"/>' +
          '<circle cx="16" cy="32" r="2.5" fill="currentColor" stroke="none"/><circle cx="42" cy="32" r="2.5" fill="currentColor" stroke="none"/><circle cx="68" cy="32" r="2.5" fill="currentColor" stroke="none"/>' +
          '<path d="M16 29V19"/><path d="M42 35v10"/><path d="M68 29V19"/>' +
          bar(8, 11.5, 18) +
          bar(34, 45, 18) +
          bar(60, 11.5, 18)
      },
      {
        id: 'timeline.v',
        label: 'Timeline · vertical',
        preset: {},
        svg:
          '<path d="M42 6v42"/>' +
          '<circle cx="42" cy="13" r="2.5" fill="currentColor" stroke="none"/><circle cx="42" cy="27" r="2.5" fill="currentColor" stroke="none"/><circle cx="42" cy="41" r="2.5" fill="currentColor" stroke="none"/>' +
          '<path d="M45 13h9"/><path d="M39 27h-9"/><path d="M45 41h9"/>' +
          bar(54, 10.5, 20) +
          bar(10, 24.5, 20) +
          bar(54, 38.5, 20)
      },
      {
        id: 'timeline.h',
        key: 'timeline.capsule',
        label: 'Timeline · capsule',
        preset: { defaultShape: 'capsule' },
        svg:
          '<path d="M6 32h72"/>' +
          '<circle cx="16" cy="32" r="2.5" fill="currentColor" stroke="none"/><circle cx="42" cy="32" r="2.5" fill="currentColor" stroke="none"/><circle cx="68" cy="32" r="2.5" fill="currentColor" stroke="none"/>' +
          '<path d="M16 29V20"/><path d="M42 35v9"/><path d="M68 29V20"/>' +
          '<rect x="7" y="11" width="18" height="9" rx="4.5"/>' +
          '<rect x="33" y="44" width="18" height="9" rx="4.5"/>' +
          '<rect x="59" y="11" width="18" height="9" rx="4.5"/>'
      }
    ]
  },
  {
    name: 'Fishbone',
    items: [
      {
        id: 'fishbone.right',
        label: 'Fishbone · right',
        preset: {},
        svg:
          '<path d="M4 27h60"/><rect x="64" y="21" width="16" height="12" rx="3"/>' +
          '<path d="M20 27 30 10"/><path d="M40 27 50 10"/><path d="M20 27 30 44"/><path d="M40 27 50 44"/>'
      },
      {
        id: 'fishbone.left',
        label: 'Fishbone · left',
        preset: {},
        svg:
          '<path d="M20 27h60"/><rect x="4" y="21" width="16" height="12" rx="3"/>' +
          '<path d="M64 27 54 10"/><path d="M44 27 34 10"/><path d="M64 27 54 44"/><path d="M44 27 34 44"/>'
      },
      {
        id: 'fishbone.right',
        key: 'fishbone.capsule',
        label: 'Fishbone · capsule',
        preset: { defaultShape: 'capsule' },
        svg:
          '<path d="M4 27h60"/><rect x="64" y="21" width="16" height="12" rx="6"/>' +
          '<path d="M20 27 30 12"/><path d="M40 27 50 12"/><path d="M20 27 30 42"/><path d="M40 27 50 42"/>' +
          '<rect x="23" y="4" width="14" height="8" rx="4"/><rect x="43" y="4" width="14" height="8" rx="4"/>' +
          '<rect x="23" y="42" width="14" height="8" rx="4"/><rect x="43" y="42" width="14" height="8" rx="4"/>'
      }
    ]
  },
  {
    name: 'Brace Map',
    items: [
      {
        id: 'brace.right',
        label: 'Brace map · right',
        preset: {},
        svg:
          bar(4, 24, 16) +
          '<path d="M34 8 C30 8 28 10 28 14 V22 C28 25 26 27 23 27 C26 27 28 29 28 32 V40 C28 44 30 46 34 46"/>' +
          bar(40, 7.5, 22) +
          bar(40, 24.5, 22) +
          bar(40, 41.5, 22)
      },
      {
        id: 'brace.left',
        label: 'Brace map · left',
        preset: {},
        svg:
          bar(64, 24, 16) +
          '<path d="M50 8 C54 8 56 10 56 14 V22 C56 25 58 27 61 27 C58 27 56 29 56 32 V40 C56 44 54 46 50 46"/>' +
          bar(22, 7.5, 22) +
          bar(22, 24.5, 22) +
          bar(22, 41.5, 22)
      },
      {
        id: 'brace.right',
        key: 'brace.capsule',
        label: 'Brace map · capsule',
        preset: { defaultShape: 'capsule' },
        svg:
          '<rect x="4" y="23" width="16" height="8" rx="4"/>' +
          '<path d="M34 8 C30 8 28 10 28 14 V22 C28 25 26 27 23 27 C26 27 28 29 28 32 V40 C28 44 30 46 34 46"/>' +
          '<rect x="40" y="5" width="22" height="9" rx="4.5"/>' +
          '<rect x="40" y="22.5" width="22" height="9" rx="4.5"/>' +
          '<rect x="40" y="40" width="22" height="9" rx="4.5"/>'
      }
    ]
  },
  {
    name: 'Tree Table',
    items: [
      {
        id: 'tree-table',
        label: 'Tree table',
        preset: {},
        svg:
          '<rect x="8" y="6" width="68" height="42" rx="2"/>' +
          '<rect x="8" y="6" width="68" height="10" rx="2" fill="currentColor" opacity=".12" stroke="none"/>' +
          '<path d="M8 16h68"/><path d="M30 16v32"/><path d="M30 32h46"/><path d="M53 32v16"/>'
      }
    ]
  },
  {
    name: 'Matrix',
    items: [
      {
        id: 'matrix',
        label: 'Matrix',
        preset: {},
        svg:
          '<rect x="8" y="8" width="68" height="38" rx="2"/>' +
          '<rect x="8" y="8" width="68" height="10" rx="2" fill="currentColor" opacity=".12" stroke="none"/>' +
          '<path d="M8 18h68"/><path d="M8 32h68"/><path d="M30 8v38"/><path d="M53 8v38"/>'
      }
    ]
  },
  {
    name: 'Grid',
    items: [
      {
        id: 'grid',
        label: 'Grid',
        preset: {},
        svg:
          bar(33, 3, 18) +
          '<rect x="8" y="13" width="32" height="17" rx="2.5"/>' +
          '<rect x="44" y="13" width="32" height="17" rx="2.5"/>' +
          '<rect x="8" y="34" width="32" height="17" rx="2.5"/>' +
          '<rect x="44" y="34" width="32" height="17" rx="2.5"/>' +
          bar(12, 17, 14) +
          bar(48, 17, 14) +
          bar(12, 38, 14) +
          bar(48, 38, 14)
      },
      {
        id: 'grid',
        key: 'grid.rounded',
        label: 'Grid · rounded cards',
        preset: { defaultShape: 'capsule' },
        svg:
          bar(33, 3, 18) +
          '<rect x="8" y="13" width="32" height="17" rx="8"/>' +
          '<rect x="44" y="13" width="32" height="17" rx="8"/>' +
          '<rect x="8" y="34" width="32" height="17" rx="8"/>' +
          '<rect x="44" y="34" width="32" height="17" rx="8"/>' +
          bar(12, 17, 14) +
          bar(48, 17, 14) +
          bar(12, 38, 14) +
          bar(48, 38, 14)
      }
    ]
  }
];

/** All cards in display order. */
export const STRUCTURE_ITEMS: readonly StructurePreview[] = STRUCTURE_CATEGORIES.flatMap(
  (c) => c.items
);

/** Card lookup keyed by `key ?? id`, for showing the active selection. */
export const STRUCTURE_PREVIEWS: ReadonlyMap<string, StructurePreview> = new Map(
  STRUCTURE_ITEMS.map((i) => [i.key ?? i.id, i])
);
