import { describe, expect, it } from 'vitest';
import { WP_TAGS, wpCache } from './cacheTags';
import { client } from './httpClient';

/** The Request openapi-fetch built, plus the Next options it should carry. */
type TaggedRequest = Request & { next?: { revalidate?: number; tags?: string[] } };

const captureRequest = () => {
  const seen: { request?: TaggedRequest } = {};
  const fetch = async (request: Request) => {
    seen.request = request as TaggedRequest;
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { seen, fetch };
};

/**
 * Cache directives reach the typed client by a route that isn't obvious, and
 * that silently degrades if it breaks: openapi-fetch builds a `Request` and
 * calls `fetch(request)`, but `new Request()` drops unknown init keys, so a
 * plain `{ next: … }` would vanish. It survives only because openapi-fetch
 * copies leftover init keys back onto the Request afterwards, and Next's patched
 * fetch reads `next` off a Request input as well as off the init argument.
 *
 * Nothing throws if that stops being true — the fetch just runs untagged and
 * unrevalidated, and `/api/revalidate/` quietly stops purging anything built
 * through the typed client. Hence this test, aimed squarely at the openapi-fetch
 * upgrade that would break it.
 */
describe('the typed WP client', () => {
  it('carries Next cache options through to the Request it fetches', async () => {
    const { seen, fetch } = captureRequest();

    await client.GET('/wp/v2/menus', { ...wpCache([WP_TAGS.menus]), fetch });

    expect(seen.request?.next).toEqual({ revalidate: 3600, tags: [WP_TAGS.all, WP_TAGS.menus] });
  });

  it('still injects Basic auth alongside them', async () => {
    const { seen, fetch } = captureRequest();

    await client.GET('/wp/v2/menus', { ...wpCache([WP_TAGS.menus]), fetch });

    expect(seen.request?.headers.get('authorization')).toMatch(/^Basic /);
  });
});
