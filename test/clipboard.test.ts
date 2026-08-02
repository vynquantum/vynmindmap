import { describe, it, expect } from 'vitest';

import { clipText, topicsFromText } from '../app/src/lib/clipboard.js';
import { addChild, createTopic } from '../src/index.js';
import type { Topic } from '../src/index.js';

/** `depth:title` lines, so nesting is visible in the assertion. */
function outline(topics: Topic[]): string[] {
  const lines: string[] = [];
  const walk = (t: Topic, d: number) => {
    lines.push(`${d}:${t.title}`);
    for (const c of t.children ?? []) walk(c, d + 1);
  };
  for (const t of topics) walk(t, 0);
  return lines;
}

describe('clipText', () => {
  it('writes an outline anyone can read, with the topics riding along', () => {
    const branch = createTopic('Branch');
    addChild(branch, 'Child');

    const text = clipText([branch]);
    expect(text.split('\n').slice(0, 2)).toEqual(['- Branch', '  - Child']);
    expect(text).toContain('<!-- vmm:clip ');
  });
});

describe('topicsFromText', () => {
  it('round-trips a copy back into the same subtree, extras and all', () => {
    const branch = createTopic('Branch');
    branch.style = { fillColor: '#ff0000' };
    branch.note = { plain: 'keep me' };
    branch.image = { resource: 'resources/a.png', width: 200, height: 150 };
    addChild(branch, 'Child');

    const back = topicsFromText(clipText([branch]));
    expect(back).toEqual([branch]);
  });

  it('reads a plain outline pasted from another app', () => {
    expect(outline(topicsFromText('Alpha\n  Beta\n  Gamma\nDelta'))).toEqual([
      '0:Alpha',
      '1:Beta',
      '1:Gamma',
      '0:Delta'
    ]);
  });

  it('nests a four-space or tabbed outline instead of flattening it', () => {
    expect(outline(topicsFromText('- Alpha\n    - Beta\n        - Gamma'))).toEqual([
      '0:Alpha',
      '1:Beta',
      '2:Gamma'
    ]);
    expect(outline(topicsFromText('- Alpha\n\t- Beta'))).toEqual(['0:Alpha', '1:Beta']);
  });

  it('ignores a payload that is not topics rather than pasting garbage', () => {
    // Both fall back to the outline, and neither leaves the comment behind as
    // a topic of its own.
    expect(outline(topicsFromText('Alpha\n<!-- vmm:clip [{"nope":1}] -->'))).toEqual(['0:Alpha']);
    expect(outline(topicsFromText('Alpha\n<!-- vmm:clip [not json] -->'))).toEqual(['0:Alpha']);
  });

  it('has nothing to paste for empty text', () => {
    expect(topicsFromText('   \n\n')).toEqual([]);
  });
});
