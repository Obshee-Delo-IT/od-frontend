import { describe, expect, it } from 'vitest';
import { toFullSizeImageUrl } from './imageUrl';

describe('toFullSizeImageUrl', () => {
  it('strips the WordPress -WIDTHxHEIGHT size suffix', () => {
    expect(toFullSizeImageUrl('https://x/uploads/2023/03/maxresdefault-300x169.jpg')).toBe(
      'https://x/uploads/2023/03/maxresdefault.jpg'
    );
    expect(toFullSizeImageUrl('https://x/image-19-1-150x150.jpg')).toBe('https://x/image-19-1.jpg');
    expect(toFullSizeImageUrl('https://x/cover-212x300.png')).toBe('https://x/cover.png');
  });

  it('preserves the query string / hash after the extension', () => {
    expect(toFullSizeImageUrl('https://x/cover-300x169.jpg?ver=2')).toBe('https://x/cover.jpg?ver=2');
  });

  it('leaves full-size and non-size-suffixed names untouched', () => {
    expect(toFullSizeImageUrl('https://x/6KUKMb5lY-5.jpg')).toBe('https://x/6KUKMb5lY-5.jpg');
    expect(toFullSizeImageUrl('https://x/uploads/photo.jpg')).toBe('https://x/uploads/photo.jpg');
    expect(toFullSizeImageUrl('https://x/uploads/photo-scaled.jpg')).toBe('https://x/uploads/photo-scaled.jpg');
  });

  it('returns null for nullish input', () => {
    expect(toFullSizeImageUrl(null)).toBeNull();
    expect(toFullSizeImageUrl(undefined)).toBeNull();
    expect(toFullSizeImageUrl('')).toBeNull();
  });
});
