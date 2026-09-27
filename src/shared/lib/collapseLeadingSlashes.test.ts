import { describe, expect, it } from 'vitest';
import { collapseLeadingSlashes } from './collapseLeadingSlashes';

describe('collapseLeadingSlashes', () => {
  it.each([
    ['//', '/'],
    ['//74794/', '/74794/'],
    ['///news/', '/news/'],
    ['////', '/'],
  ])('collapses %s to %s', (pathname, expected) => {
    expect(collapseLeadingSlashes(pathname)).toBe(expected);
  });

  /* `null`, not the path back: the caller navigates on a string, and handing it
     one for a path that is already single-slashed is an endless replace(). */
  it.each(['/', '/74794/', '/news//', '/contacts/ivanovskaya/'])('leaves %s alone', (pathname) => {
    expect(collapseLeadingSlashes(pathname)).toBeNull();
  });
});
