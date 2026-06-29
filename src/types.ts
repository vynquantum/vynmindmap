/**
 * VynMM core data model — the in-memory shape of a `.vmm` workbook.
 *
 * This mirrors the on-disk `content.json` schema (see DESIGN.md §4.3) one-to-one,
 * so (de)serialization is a near-identity transform. The GUI and the AI tooling
 * both operate on a `Workbook`.
 */

// ---------------------------------------------------------------------------
// Manifest (manifest.json inside the .vmm zip)
// ---------------------------------------------------------------------------

export interface Manifest {
  /** Always "vmm". Identifies the container kind. */
  format: "vmm";
  /** Schema version, "MAJOR.MINOR". See DESIGN.md §7. */
  formatVersion: string;
  /** Producing application name. */
  app: string;
  /** Producing application version. */
  appVersion: string;
  /** ISO-8601 timestamp. */
  created: string;
  /** ISO-8601 timestamp. */
  modified: string;
}

// ---------------------------------------------------------------------------
// Structures (per-sheet layout) — DESIGN.md §5.1
// ---------------------------------------------------------------------------

export type StructureId =
  | "map.balanced" | "map.left" | "map.right"
  | "logic.right" | "logic.left"
  | "org.down" | "org.up"
  | "tree.right" | "tree.left"
  | "timeline.h" | "timeline.v"
  | "fishbone.right" | "fishbone.left"
  | "matrix"
  | "tree-table"
  | "brace.right" | "brace.left";

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

export type TopicShape =
  | "rounded" | "rect" | "ellipse" | "underline" | "capsule" | "none";

export interface FontStyle {
  family?: string;
  size?: number;
  weight?: "normal" | "bold";
  style?: "normal" | "italic";
  color?: string;
  decoration?: "none" | "underline" | "line-through";
}

export interface TopicStyle {
  shape?: TopicShape;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  /** Branch line drawn from this topic to its children. */
  lineColor?: string;
  lineWidth?: number;
  lineTaper?: boolean;
  font?: FontStyle;
}

// ---------------------------------------------------------------------------
// Attachments / decorations
// ---------------------------------------------------------------------------

export type HyperlinkType = "web" | "file" | "topic" | "email";

export interface Hyperlink {
  type: HyperlinkType;
  /** URL, file path, topic id, or email depending on `type`. */
  value: string;
}

export interface Note {
  /** Plain-text fallback, always present if a note exists. */
  plain: string;
  /** Optional rich representation (HTML/portable JSON); null if none. */
  rich?: string | null;
}

export interface TopicImage {
  /** Path into the zip's resources/ folder. */
  resource: string;
  width?: number;
  height?: number;
}

export interface Attachment {
  /** Path into the zip's resources/ folder. */
  resource: string;
  /** Display name. */
  name: string;
}

export interface Position {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Topic — the recursive node
// ---------------------------------------------------------------------------

export interface Topic {
  id: string;
  /** Inline-markdown text. */
  title: string;
  /** Optional per-subtree structure override; null inherits the sheet's. */
  structureClass?: StructureId | null;
  collapsed?: boolean;
  /** Explicit canvas position (floating topics / manual layout); null = auto. */
  position?: Position | null;

  children?: Topic[];
  callouts?: Topic[];

  style?: TopicStyle;
  markers?: string[];
  labels?: string[];
  note?: Note | null;
  hyperlink?: Hyperlink | null;
  image?: TopicImage | null;
  attachments?: Attachment[];
}

// ---------------------------------------------------------------------------
// Connectors & groupings
// ---------------------------------------------------------------------------

export interface RelationshipStyle {
  lineColor?: string;
  lineWidth?: number;
  lineShape?: "curved" | "straight" | "elbow";
  arrow?: "none" | "end" | "both";
}

export interface Relationship {
  id: string;
  end1Id: string;
  end2Id: string;
  title?: string;
  style?: RelationshipStyle;
  controlPoints?: Position[] | null;
}

export interface Boundary {
  id: string;
  /** Parent topic whose children the boundary groups. */
  parentId: string;
  /** Ids of the contiguous child topics enclosed. */
  childIds: string[];
  title?: string;
  shape?: "rounded" | "rect" | "scallop" | "polygon";
  style?: { fillColor?: string; borderColor?: string };
}

export interface Summary {
  id: string;
  parentId: string;
  /** Ids of the contiguous child topics summarized. */
  childIds: string[];
  shape?: "curly" | "square" | "round";
  /** The topic produced by the summary bracket. */
  summaryTopic: Topic;
}

// ---------------------------------------------------------------------------
// Sheet & Workbook
// ---------------------------------------------------------------------------

export interface SheetBackground {
  color?: string;
  image?: string | null;
}

export interface SheetSettings {
  rainbowBranches?: boolean;
  [key: string]: unknown;
}

export interface Sheet {
  id: string;
  title: string;
  structure: StructureId;
  theme: string;
  background?: SheetBackground;
  settings?: SheetSettings;

  rootTopic: Topic;
  floatingTopics?: Topic[];
  relationships?: Relationship[];
  boundaries?: Boundary[];
  summaries?: Summary[];
}

export interface Workbook {
  id: string;
  sheets: Sheet[];
  /**
   * Fields from a newer minor format version that this build did not recognize,
   * preserved verbatim so a round-trip through an older app is non-destructive
   * (DESIGN.md §7). Not part of the public schema.
   */
  _unknown?: Record<string, unknown>;
}

/** A fully-loaded `.vmm`: manifest + workbook + raw resource bytes. */
export interface VmmDocument {
  manifest: Manifest;
  workbook: Workbook;
  /** Embedded binary resources, keyed by their in-zip path (e.g. "resources/x.png"). */
  resources: Record<string, Uint8Array>;
}
