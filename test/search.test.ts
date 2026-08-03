import { describe, it, expect } from 'vitest';

import { matchField } from '../app/src/lib/search.js';
import type { Topic } from '../src/index.js';

const topic = (extra: Partial<Topic> = {}): Topic => ({ id: 't', title: 'Launch plan', ...extra });

describe('matchField', () => {
  it('matches a title, case-insensitively', () => {
    expect(matchField(topic(), 'LAUNCH')).toBe('title');
  });

  it('matches the plain text of a note, but not the HTML of a rich one', () => {
    const t = topic({ note: { plain: 'ship on Monday', rich: '<p>ship on <b>Monday</b></p>' } });
    expect(matchField(t, 'monday')).toBe('note');
    // "b" only appears in the markup, so it must not drag every note into the hits.
    expect(matchField(t, 'b>')).toBeNull();
  });

  it('matches labels and markers', () => {
    expect(matchField(topic({ labels: ['urgent'] }), 'urg')).toBe('label');
    expect(matchField(topic({ markers: ['priority-1'] }), 'priority')).toBe('marker');
  });

  it('reports the title first when several parts match', () => {
    expect(matchField(topic({ title: 'plan', labels: ['plan'] }), 'plan')).toBe('title');
  });

  it('misses when nothing contains the query, and on an empty query', () => {
    expect(matchField(topic(), 'nowhere')).toBeNull();
    expect(matchField(topic(), '')).toBeNull();
  });
});
