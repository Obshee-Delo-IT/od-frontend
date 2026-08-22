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

  it('skips inline blobs and takes the next real file', () => {
    // `/contacts/` carries four of these, and the scheme-less form is the one
    // that used to resolve into a URL on the WordPress origin that 404s.
    expect(extractFirstImage('<img src="data:image/png;base64,AAAA"><img src="https://a/real.jpg">')).toBe(
      'https://a/real.jpg'
    );
    expect(
      extractFirstImage('<img src="image/png;base64,AAAA"><img src="/wp-content/x.jpg">', 'https://wp.example')
    ).toBe('https://wp.example/wp-content/x.jpg');
  });

  it('returns null when every image is an inline blob', () => {
    expect(extractFirstImage('<img src="image/png;base64,AAAA"><img src="data:image/gif;base64,BBBB">')).toBe(null);
  });

  it('returns null when no image present', () => {
    expect(extractFirstImage('<p>text only</p>')).toBe(null);
    expect(extractFirstImage('')).toBe(null);
    expect(extractFirstImage(null)).toBe(null);
    expect(extractFirstImage(undefined)).toBe(null);
  });
});
