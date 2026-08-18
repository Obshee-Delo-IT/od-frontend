import { afterEach, describe, expect, it, vi } from 'vitest';

const wpFetch = vi.fn();

vi.mock('./httpClient', () => ({
  wpFetch: (...args: unknown[]) => wpFetch(...args),
  wpBaseUrl: 'https://wp.test',
}));

// The card's photo goes through the media pipeline like every other WP image; the
// marker is enough to prove it was not taken straight from the payload.
vi.mock('./mediaUrl', () => ({
  resolveMediaUrl: vi.fn(async (url?: string) => (url ? `${url}#resolved` : null)),
}));

import { fetchProfile } from './fetchProfile';

const makeResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const record = (over: Record<string, unknown> = {}) => ({
  id: 46651,
  title: { rendered: 'Андрей&nbsp;Алексеевич Рязанов' },
  content: {
    rendered:
      '<p><strong>Координатор по городу Магнитогорску</strong></p>' +
      '<p><a href="tel:+7(904)818-08-69">+7(904)818-08-69</a></p>' +
      '<p><a href="https://t.me/paramon1302">@paramon1302</a></p>',
  },
  meta: { cmsms_profile_subtitle: 'Магнитогорск' },
  ...over,
});

afterEach(() => {
  wpFetch.mockReset();
});

describe('fetchProfile', () => {
  it('queries by slug and maps the record onto the card', async () => {
    wpFetch.mockResolvedValue(makeResponse([record()]));

    const card = await fetchProfile('vatrushkin');

    expect(wpFetch.mock.calls[0][0]).toContain('/wp/v2/profile?slug=vatrushkin');
    // `_embed` rather than a second request for the featured image.
    expect(wpFetch.mock.calls[0][0]).toContain('_embed=1');
    expect(card).toEqual({
      id: 46651,
      name: 'Андрей Алексеевич Рязанов',
      subtitle: 'Координатор по городу Магнитогорску',
      photo: null,
      contacts: [
        { kind: 'phone', href: 'tel:+7(904)818-08-69', label: '+7(904)818-08-69' },
        { kind: 'telegram', href: 'https://t.me/paramon1302', label: '@paramon1302' },
      ],
    });
  });

  it('falls back to the region meta when the body bolds nothing', async () => {
    // 56 of the 139 records are this shape, and the fallback is what the
    // `cmsms_profile_subtitle` registration in `od-profile.php` keeps alive.
    wpFetch.mockResolvedValue(makeResponse([record({ content: { rendered: '<p>без роли</p>' } })]));

    await expect(fetchProfile('x')).resolves.toMatchObject({ subtitle: 'Магнитогорск' });
  });

  it('leaves the subtitle empty when the record has neither', async () => {
    wpFetch.mockResolvedValue(makeResponse([record({ content: { rendered: '' }, meta: {} })]));

    await expect(fetchProfile('x')).resolves.toMatchObject({ subtitle: null });
  });

  it('resolves the featured image through the media pipeline', async () => {
    wpFetch.mockResolvedValue(
      makeResponse([
        record({
          _embedded: { 'wp:featuredmedia': [{ source_url: 'https://wp.test/ryazanov.jpg', alt_text: '' }] },
        }),
      ])
    );

    // `alt_text` is empty on every record sampled, so the name is the fallback.
    await expect(fetchProfile('x')).resolves.toMatchObject({
      photo: { src: 'https://wp.test/ryazanov.jpg#resolved', alt: 'Андрей Алексеевич Рязанов' },
    });
  });

  it('answers null rather than throwing when the record is gone', async () => {
    // A page can link a profile that has since been unpublished; the link then
    // stays a link instead of taking the whole page down.
    wpFetch.mockResolvedValue(makeResponse([], 404));

    await expect(fetchProfile('gone')).resolves.toBeNull();
  });

  it('answers null for an empty result and for an empty slug', async () => {
    wpFetch.mockResolvedValue(makeResponse([]));
    await expect(fetchProfile('nobody')).resolves.toBeNull();

    await expect(fetchProfile('')).resolves.toBeNull();
    expect(wpFetch).toHaveBeenCalledTimes(1);
  });
});
