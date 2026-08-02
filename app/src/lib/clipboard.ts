/**
 * Topics ↔ clipboard text.
 *
 * The canvas keeps its own in-window clipboard of real `Topic` objects, but
 * that can't reach another VynMM window or any other app. What goes on the OS
 * clipboard is an indented outline — readable and pasteable anywhere — with the
 * topics themselves appended in an HTML comment, so a paste back into a map
 * restores styles, notes, images and children instead of bare titles.
 */

import { markdownToSheet } from '../../../src/index.js';
import type { Topic } from '../../../src/index.js';

const CLIP_META = /<!--\s*vmm:clip\s*(\[[\s\S]*?\])\s*-->/;

export function clipText(topics: readonly Topic[]): string {
  const out: string[] = [];
  const emit = (t: Topic, depth: number) => {
    out.push(`${'  '.repeat(depth)}- ${t.title.replace(/\r?\n/g, ' ')}`);
    for (const c of t.children ?? []) emit(c, depth + 1);
  };
  for (const t of topics) emit(t, 0);
  out.push(`<!-- vmm:clip ${JSON.stringify(topics)} -->`);
  return out.join('\n');
}

/** Text from anywhere → topics: our own payload verbatim, anything else by
 * indentation, so an outline copied out of a document arrives as a tree. */
export function topicsFromText(text: string): Topic[] {
  const m = CLIP_META.exec(text);
  if (m) {
    try {
      const parsed: unknown = JSON.parse(m[1]!);
      // Only payloads that look like topics: anyone can put text on a clipboard.
      if (
        Array.isArray(parsed) &&
        parsed.length &&
        parsed.every((t) => t && typeof (t as Topic).title === 'string')
      ) {
        return parsed as Topic[];
      }
    } catch {
      /* not ours after all — fall through to the outline reader */
    }
  }
  // A payload we couldn't use is still not a topic: drop the comment rather
  // than paste it as a title.
  return outlineToTopics(text.replace(CLIP_META, ''));
}

function outlineToTopics(text: string): Topic[] {
  const indentOf = (l: string) => /^[ \t]*/.exec(l)![0].replace(/\t/g, '  ').length;
  const kept = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  if (!kept.length) return [];
  // Re-indent to the two spaces per level the Markdown reader expects, so a
  // four-space or tabbed outline nests instead of flattening. The smallest
  // indent in the text is one level; a flat list has none and never divides.
  const indents = kept.map(indentOf).filter((i) => i > 0);
  const step = indents.length ? Math.min(...indents) : 2;
  const md = kept
    .map((l) => {
      const body = l.trim();
      // A heading only reads as one at the start of the line, so it never takes
      // the indent; every other line becomes a list item at its own depth.
      if (/^#{1,6}\s/.test(body)) return body;
      const item = /^[-*]\s/.test(body) ? body : `- ${body}`;
      return '  '.repeat(Math.round(indentOf(l) / step)) + item;
    })
    .join('\n');
  // A synthetic root the paste never keeps: it only gives the reader a parent.
  return markdownToSheet(`# vmm-clip\n${md}`).rootTopic.children ?? [];
}
