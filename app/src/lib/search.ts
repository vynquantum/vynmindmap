/**
 * What "find" looks at on a topic.
 *
 * Titles are only the headline: the sentence someone is trying to find again is
 * usually in a note, and the way they group work is usually a label or a marker.
 * Searching all four is what makes Ctrl+F find the thing rather than the topic
 * that happens to be named after it.
 */

import type { Topic } from '../../../src/index.js';

/** Which part of a topic a query hit, or null when it misses. */
export type MatchField = 'title' | 'note' | 'label' | 'marker';

/** Case-insensitive; a blank query never matches. */
export function matchField(t: Topic, query: string): MatchField | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const has = (s: string | undefined) => !!s && s.toLowerCase().includes(q);
  if (has(t.title)) return 'title';
  // Only the plain text of a note: the rich copy is HTML, where a query like
  // "b" would hit every bold tag in the map.
  if (has(t.note?.plain)) return 'note';
  if (t.labels?.some(has)) return 'label';
  if (t.markers?.some(has)) return 'marker';
  return null;
}
