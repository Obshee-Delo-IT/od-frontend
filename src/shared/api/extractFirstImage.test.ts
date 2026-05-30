import { describe, expect, it } from 'vitest';
import { extractFirstImage } from './extractFirstImage';

describe('extractFirstImage', () => {
  it('returns the first <img src> in the html', () => {
    expect(extractFirstImage('<p>foo</p><img src="https://a/b.jpg" alt="x"><img src="second.jpg">')).toBe(
      'https://a/b.jpg'
    );
  });

  it('handles single quotes', () => {
    expect(extractFirstImage("<img src='one.png'>")).toBe('one.png');
  });

  it('returns null when no image present', () => {
    expect(extractFirstImage('<p>text only</p>')).toBe(null);
    expect(extractFirstImage('')).toBe(null);
    expect(extractFirstImage(null)).toBe(null);
    expect(extractFirstImage(undefined)).toBe(null);
  });
});
