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

  it('rewrites <audio src> too — the materials mp3s live in the uploads tree', async () => {
    const html = '<figure class="wp-block-audio"><audio controls src="/wp-content/uploads/a.mp3"></audio></figure>';

    expect(await resolveContentImages(html)).toContain('src="/wp-content/uploads/a.mp3#resolved"');
  });

  it('never makes an <audio> the eager LCP element', async () => {
    const html = '<audio controls src="/wp-content/uploads/a.mp3"></audio><img src="https://wp.test/c.jpg" alt=""/>';
    const out = await resolveContentImages(html, true);

    expect(out).not.toContain('<audio loading="eager"');
    expect(out).toContain('<img loading="eager" fetchpriority="high"');
  });

  it('makes the first image eager and leaves the rest lazy', async () => {
    const html =
      '<img src="https://wp.test/cover.jpg" loading="lazy" alt="a"/><img src="https://wp.test/next.jpg" loading="lazy" alt="b"/>';
    const out = await resolveContentImages(html, true);
    const [first, second] = out.match(/<img\b[^>]*>/g) ?? [];

    // WordPress lazy-loads every image in a body, including the one that is the
    // page's LCP element.
    expect(first).toContain('loading="eager"');
    expect(first).toContain('fetchpriority="high"');
    expect(first).not.toContain('loading="lazy"');
    expect(second).toContain('loading="lazy"');
    expect(second).not.toContain('fetchpriority');
  });

  it('leaves lazy loading alone by default — a footer widget is not a main body', async () => {
    const html = '<img src="https://wp.test/logo.png" loading="lazy" alt=""/>';

    expect(await resolveContentImages(html)).toContain('loading="lazy"');
    expect(await resolveContentImages(html)).not.toContain('fetchpriority');
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
