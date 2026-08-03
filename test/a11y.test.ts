import { describe, it, expect } from 'vitest';

import { nextFocusIndex } from '../app/src/lib/a11y.js';

describe('nextFocusIndex', () => {
  it('steps forward and wraps past the last item', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  it('steps backward and wraps past the first item', () => {
    expect(nextFocusIndex(3, 2, true)).toBe(1);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });

  it('enters the list from outside at whichever end Tab came from', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });

  it('has nowhere to go in an empty dialog', () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1);
  });
});
