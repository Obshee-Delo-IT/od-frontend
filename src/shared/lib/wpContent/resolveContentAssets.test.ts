import { describe, expect, it, vi } from 'vitest';

// Echo a marker so the test can assert each <img src> was run through the resolver.
vi.mock('@/shared/api', () => ({
  resolveMediaUrl: vi.fn(async (url: string) => `${url.replace(/-\d+x\d+(?=\.\w+$)/, '')}#resolved`),
}));

import { resolveContentAssets } from './resolveContentAssets';

describe('resolveContentAssets', () => {
  it('rewrites each <img src> via the resolver and drops srcset/sizes', async () => {
    const html =
      '<p>x</p><img src="https://wp.test/a-150x150.jpg" srcset="https://wp.test/a-150x150.jpg 150w, https://wp.test/a-300x300.jpg 300w" sizes="(max-width: 600px) 100vw, 600px" alt="x"/>';
    const out = await resolveContentAssets(html);

    expect(out).toContain('src="https://wp.test/a.jpg#resolved"');
    expect(out).not.toContain('srcset');
    expect(out).not.toMatch(/\ssizes=/);
    expect(out).toContain('<p>x</p>');
  });

  it('rewrites the media <a href> the lightbox opens', async () => {
    const html =
      '<figure><a href="/wp-content/uploads/2019/11/poster-scaled.jpg"><img src="/wp-content/uploads/2019/11/poster-270h.jpg" alt=""/></a></figure>';
    const out = await resolveContentAssets(html);

    // Both, and to different files: the href is the print-quality poster, the
    // src is the preview the editor picked.
    expect(out).toContain('href="/wp-content/uploads/2019/11/poster-scaled.jpg#resolved"');
    expect(out).toContain('src="/wp-content/uploads/2019/11/poster-270h.jpg#resolved"');
  });

  it('leaves a link to a page alone', async () => {
    const html = '<a href="/healthy-russia/"><img src="https://wp.test/a.jpg" alt=""/></a>';

    expect(await resolveContentAssets(html)).toContain('href="/healthy-russia/"');
  });

  it('rewrites <audio src> too — the materials mp3s live in the uploads tree', async () => {
    const html = '<figure class="wp-block-audio"><audio controls src="/wp-content/uploads/a.mp3"></audio></figure>';

    expect(await resolveContentAssets(html)).toContain('src="/wp-content/uploads/a.mp3#resolved"');
  });

  it('never makes an <audio> the eager LCP element', async () => {
    const html = '<audio controls src="/wp-content/uploads/a.mp3"></audio><img src="https://wp.test/c.jpg" alt=""/>';
    const out = await resolveContentAssets(html, true);

    expect(out).not.toContain('<audio loading="eager"');
    expect(out).toContain('<img loading="eager" fetchPriority="high"');
  });

  it('makes the first image eager and leaves the rest lazy', async () => {
    const html =
      '<img src="https://wp.test/cover.jpg" loading="lazy" alt="a"/><img src="https://wp.test/next.jpg" loading="lazy" alt="b"/>';
    const out = await resolveContentAssets(html, true);
    const [first, second] = out.match(/<img\b[^>]*>/g) ?? [];

    // WordPress lazy-loads every image in a body, including the one that is the
    // page's LCP element.
    expect(first).toContain('loading="eager"');
    expect(first).toContain('fetchPriority="high"');
    expect(first).not.toContain('loading="lazy"');
    expect(second).toContain('loading="lazy"');
    expect(second).not.toContain('fetchPriority');
  });

  /**
   * The regression behind the `loading="lazy"` default: `/about/` comes back from
   * WordPress with images carrying no `loading` at all, which is eager, which puts
   * a preload hint in the route's flight payload — so the App Router's prefetch of
   * the nav link downloaded seven bucket images on every page of the site.
   */
  it('lazy-loads an image WordPress left without a loading attribute', async () => {
    const html = '<img src="https://wp.test/hero.jpg" alt="a"/><img src="https://wp.test/logo.png" alt="b"/>';
    const [first, second] = ((await resolveContentAssets(html, true)).match(/<img\b[^>]*>/g) ?? []) as string[];

    expect(first).toContain('loading="eager"');
    expect(second).toContain('loading="lazy"');
  });

  it('lazy-loads a widget image WordPress left without a loading attribute', async () => {
    const html = '<img src="https://wp.test/logo.png" alt=""/>';
    const out = await resolveContentAssets(html);

    expect(out).toContain('loading="lazy"');
    expect(out).not.toContain('fetchPriority');
  });

  it('never puts loading on an <audio>', async () => {
    const html = '<audio controls src="/wp-content/uploads/a.mp3"></audio>';

    expect(await resolveContentAssets(html)).not.toContain('loading=');
  });

  it('leaves lazy loading alone by default — a footer widget is not a main body', async () => {
    const html = '<img src="https://wp.test/logo.png" loading="lazy" alt=""/>';

    expect(await resolveContentAssets(html)).toContain('loading="lazy"');
    expect(await resolveContentAssets(html)).not.toContain('fetchPriority');
  });

  it('rewrites multiple images', async () => {
    const html = '<img src="https://wp.test/one.jpg"><img src="https://wp.test/two.png">';
    const out = await resolveContentAssets(html);

    expect(out).toContain('src="https://wp.test/one.jpg#resolved"');
    expect(out).toContain('src="https://wp.test/two.png#resolved"');
  });

  it('returns html unchanged when there are no images', async () => {
    expect(await resolveContentAssets('<p>no images here</p>')).toBe('<p>no images here</p>');
  });

  it('returns an empty string for nullish input', async () => {
    expect(await resolveContentAssets(undefined)).toBe('');
    expect(await resolveContentAssets('')).toBe('');
  });
});
