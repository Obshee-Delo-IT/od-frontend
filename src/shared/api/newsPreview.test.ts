import { describe, expect, it } from 'vitest';
import { buildNewsPreview, stripHtml } from './newsPreview';

describe('stripHtml', () => {
  it('strips tags and collapses whitespace', () => {
    expect(stripHtml('<p>Hello   <strong>world</strong></p>\n')).toBe('Hello world');
  });

  it('drops <style> and <script> blocks with their inner content', () => {
    expect(stripHtml('<style>.x{width:100%}</style><p>Text</p>')).toBe('Text');
    expect(stripHtml('<script>alert(1)</script>Body')).toBe('Body');
  });

  it('decodes named and numeric entities', () => {
    expect(stripHtml('&laquo;Word&raquo; &amp; more&hellip;')).toBe('«Word» & more…');
    expect(stripHtml('a&#8230; b&#8212;c')).toBe('a… b—c');
  });

  it('returns an empty string for nullish input', () => {
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml(null)).toBe('');
    expect(stripHtml('')).toBe('');
  });
});

describe('buildNewsPreview', () => {
  it('prefers the excerpt when present', () => {
    expect(buildNewsPreview('<p>Real excerpt</p>', '<p>Full content</p>')).toBe('Real excerpt');
  });

  it('falls back to content when the excerpt is empty', () => {
    expect(buildNewsPreview('', '<style>.x{}</style><p>Content body</p>')).toBe('Content body');
    expect(buildNewsPreview(undefined, '<p>Body only</p>')).toBe('Body only');
  });

  it('returns null when neither excerpt nor content has text', () => {
    expect(buildNewsPreview('', '')).toBeNull();
    expect(buildNewsPreview(undefined, undefined)).toBeNull();
  });

  it('truncates a long content fallback at a word boundary with an ellipsis', () => {
    const long = `<p>${'word '.repeat(100).trim()}</p>`;
    const preview = buildNewsPreview('', long);

    expect(preview).not.toBeNull();
    expect(preview!.length).toBeLessThanOrEqual(301);
    expect(preview!.endsWith('…')).toBe(true);
    expect(preview).not.toContain('wor…'); // cut on whitespace, not mid-word
  });
});
