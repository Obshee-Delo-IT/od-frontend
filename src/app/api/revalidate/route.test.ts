import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const { revalidatePath, revalidateTag } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// The real ones need a Next work store and throw an invariant outside a render
// or request; this suite is about the routing and the guards in front of them.
vi.mock('next/cache', () => ({ revalidatePath, revalidateTag }));

const SECRET = 'test-secret';

const post = (body: unknown, secret: string | null = SECRET) =>
  POST(
    new Request('https://example.test/api/revalidate/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(secret === null ? {} : { 'x-revalidate-secret': secret }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );

const purgedTags = () => revalidateTag.mock.calls.map(([tag]) => tag);

beforeEach(() => {
  vi.stubEnv('REVALIDATE_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/revalidate — authorisation', () => {
  it('is inert on a deployment with no secret configured', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');

    const response = await post({ postId: 1 });

    expect(response.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects a missing secret', async () => {
    expect((await post({ postId: 1 }, null)).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret, including one that merely starts right', async () => {
    expect((await post({ postId: 1 }, 'nope')).status).toBe(401);
    expect((await post({ postId: 1 }, `${SECRET}-and-more`)).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe('POST /api/revalidate — what it purges', () => {
  it('turns a post id into the post tag and the listings tag', async () => {
    const response = await post({ postId: 39664 });

    expect(response.status).toBe(200);
    expect(purgedTags()).toEqual(['wp:post:39664', 'wp:posts']);
  });

  it('expires immediately rather than marking stale', async () => {
    // A named profile ('max' and friends) only marks the entry stale, which
    // serves the pre-edit page once more — the thing this route exists to avoid.
    await post({ postId: 1 });

    expect(revalidateTag).toHaveBeenCalledWith('wp:post:1', { expire: 0 });
  });

  it('accepts explicit tags', async () => {
    const response = await post({ tags: ['wp:films', 'wp:menus'] });

    expect(response.status).toBe(200);
    expect(purgedTags()).toEqual(['wp:films', 'wp:menus']);
  });

  it('purges both slash variants of a path, since trailingSlash hides which was rendered', async () => {
    const response = await post({ paths: ['/news/'] });

    expect(response.status).toBe(200);
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(['/news/', '/news']);
  });

  it('leaves the root path alone', async () => {
    await post({ paths: ['/'] });

    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(['/']);
  });

  it('deduplicates a post id that is also passed as a tag', async () => {
    await post({ postId: 7, tags: ['wp:post:7'] });

    expect(purgedTags()).toEqual(['wp:post:7', 'wp:posts']);
  });
});

describe('POST /api/revalidate — refusals', () => {
  it("refuses tags outside the project's namespace", async () => {
    // `_N_T_/…` are Next's implicit route tags: accepting them would let a
    // leaked secret purge the entire render cache, fallback pages included.
    const response = await post({ tags: ['_N_T_/'] });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ rejected: ['_N_T_/'] });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses a request that names nothing, rather than purging everything', async () => {
    expect((await post({})).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses a non-numeric post id', async () => {
    expect((await post({ postId: '12; DROP' })).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses relative paths', async () => {
    expect((await post({ paths: ['news'] })).status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses malformed bodies', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post(['wp:posts'])).status).toBe(400);
    expect((await post({ tags: [''] })).status).toBe(400);
    expect((await post({ tags: 'wp:posts' })).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('caps how much one request can ask for', async () => {
    const response = await post({ tags: Array.from({ length: 51 }, (_, index) => `wp:post:${index}`) });

    expect(response.status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe('GET /api/revalidate', () => {
  it('is not allowed — the endpoint mutates cache state', async () => {
    expect((await GET()).status).toBe(405);
  });
});
