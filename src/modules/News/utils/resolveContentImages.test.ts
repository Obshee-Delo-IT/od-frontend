import { describe, expect, it, vi } from 'vitest';

// Echo a marker so the test can assert each <img src> was run through the resolver.
vi.mock('@/shared/api', () => ({
  resolveMediaUrl: vi.fn(async (url: string) => `${url.replace(/-\d+x\d+(?=\.\w+$)/, '')}#resolved`),
}));

import { resolveContentImages } from './resolveContentImages';

describe('resolveContentImages', () => {
  it('rewrites each <img src> via the resolver and drops srcset/sizes', async () => {
    const html =
      '<p>x</p><img src="https://wp.test/a-150x150.jpg" srcset="https://wp.test/a-150x150.jpg 150w, https://wp.test/a-300x300.jpg 300w" sizes="(max-width: 600px) 100vw, 600px" alt="x"/>';
    const out = await resolveContentImages(html);

    expect(out).toContain('src="https://wp.test/a.jpg#resolved"');
    expect(out).not.toContain('srcset');
    expect(out).not.toMatch(/\ssizes=/);
    expect(out).toContain('<p>x</p>');
  });

  it('rewrites multiple images', async () => {
    const html = '<img src="https://wp.test/one.jpg"><img src="https://wp.test/two.png">';
    const out = await resolveContentImages(html);

    expect(out).toContain('src="https://wp.test/one.jpg#resolved"');
    expect(out).toContain('src="https://wp.test/two.png#resolved"');
  });

  it('returns html unchanged when there are no images', async () => {
    expect(await resolveContentImages('<p>no images here</p>')).toBe('<p>no images here</p>');
  });

  it('returns an empty string for nullish input', async () => {
    expect(await resolveContentImages(undefined)).toBe('');
    expect(await resolveContentImages('')).toBe('');
  });
});
