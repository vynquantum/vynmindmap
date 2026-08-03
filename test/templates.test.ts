import { describe, it, expect } from 'vitest';

import { TEMPLATES, templateWorkbook } from '../app/src/lib/templates.js';
import { walkSheetTopics } from '../src/index.js';

describe('starter templates', () => {
  it('every template parses into a single sheet with branches', () => {
    for (const t of TEMPLATES) {
      const wb = templateWorkbook(t.id);
      expect(wb, t.id).not.toBeNull();
      expect(wb!.sheets, t.id).toHaveLength(1);
      const root = wb!.sheets[0]!.rootTopic;
      expect(root.title, t.id).toBeTruthy();
      // A template with no branches would drop the user back on a blank map.
      expect(root.children?.length ?? 0, t.id).toBeGreaterThan(2);
    }
  });

  it('gives every topic a unique id, so merging templates is safe', () => {
    for (const t of TEMPLATES) {
      const ids = [...walkSheetTopics(templateWorkbook(t.id)!.sheets[0]!)].map((x) => x.id);
      expect(new Set(ids).size, t.id).toBe(ids.length);
    }
  });

  it('keeps the structure asked for in the frontmatter', () => {
    expect(templateWorkbook('study')!.sheets[0]!.structure).toBe('tree.right');
    expect(templateWorkbook('decision')!.sheets[0]!.structure).toBe('org.down');
  });

  it('returns null for an unknown id', () => {
    expect(templateWorkbook('nope')).toBeNull();
  });

  it('builds a fresh workbook each time, so two templates never share topics', () => {
    const a = templateWorkbook('retro')!.sheets[0]!.rootTopic;
    const b = templateWorkbook('retro')!.sheets[0]!.rootTopic;
    a.title = 'edited';
    expect(b.title).toBe('Retrospective');
  });
});
