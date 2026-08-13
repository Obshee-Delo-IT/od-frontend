import { revalidatePath, revalidateTag } from 'next/cache';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isWpTag, postTag, WP_TAGS } from '@/shared/api/cacheTags';

/**
 * On-demand revalidation (B4).
 *
 * Without this, a WordPress edit reaches the site only when the hour-long ISR
 * window rolls over — the editor publishes a correction and watches the old
 * copy for up to an hour with no way to hurry it. A POST here purges the cache
 * tags written by `shared/api/cacheTags.ts`, which drops both the cached WP
 * response and every prerendered page built from it.
 *
 * **Nothing calls this yet.** The WordPress half — a `save_post` hook posting
 * the id — is in `docs/wp-backend.md` §6.5, and needs WP access to install.
 * Until then the route is inert, and stays inert on any deployment without
 * `REVALIDATE_SECRET` set.
 *
 * ```
 * curl -X POST https://host/api/revalidate/ \
 *   -H 'content-type: application/json' \
 *   -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *   -d '{"postId": 39664}'
 * ```
 *
 * **Post to `/api/revalidate/` with the trailing slash** — `trailingSlash: true`
 * (A8) makes the slashless form a 308, and a client that doesn't follow
 * redirects on POST never arrives. Same trap as `/health/`.
 */
export const dynamic = 'force-dynamic';

/** Bounds the work one request can ask for. */
const MAX_ITEMS = 50;

interface RevalidateBody {
  /** A WP post id — purges its page and every listing it can appear in. */
  postId?: number | string;
  /** The same, batched: one WP request can change many posts (a bulk trash). */
  postIds?: (number | string)[];
  /** Explicit `wp:*` tags, for changes a post id doesn't describe. */
  tags?: string[];
  /** Route paths, for pages no WP fetch tags — the A6 fallback, mainly. */
  paths?: string[];
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/**
 * Constant-time secret comparison. Hashed first so the comparison is over two
 * equal-length digests: `timingSafeEqual` throws on a length mismatch, and
 * branching on that would leak the secret's length.
 */
const matchesSecret = (candidate: string, secret: string): boolean =>
  timingSafeEqual(createHash('sha256').update(candidate).digest(), createHash('sha256').update(secret).digest());

/**
 * `revalidatePath` addresses a route by an implicit tag derived from the
 * pathname it was rendered at, and `trailingSlash: true` means it is not
 * obvious from the outside whether that was `/news` or `/news/`. Purging both
 * costs one extra tag write and removes the guess.
 */
const pathVariants = (path: string): string[] => {
  if (path === '/') {
    return [path];
  }
  return path.endsWith('/') ? [path, path.slice(0, -1)] : [path, `${path}/`];
};

const asStringArray = (value: unknown): string[] | null => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    return null;
  }
  return value as string[];
};

export const POST = async (request: Request): Promise<Response> => {
  // Read per request, not at module load: a deployment can be handed the secret
  // without a rebuild, and the tests can stub it.
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return json({ error: 'REVALIDATE_SECRET is not configured on this deployment' }, 503);
  }

  const provided = request.headers.get('x-revalidate-secret');
  // Header only — a `?secret=` fallback would put the secret in every access
  // log and proxy trace between WordPress and here.
  if (!provided || !matchesSecret(provided, secret)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: RevalidateBody;
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return json({ error: 'body must be a JSON object' }, 400);
  }

  const requestedTags = asStringArray(body.tags);
  const requestedPaths = asStringArray(body.paths);
  if (!requestedTags || !requestedPaths) {
    return json({ error: '`tags` and `paths` must be arrays of non-empty strings' }, 400);
  }

  const ids: unknown[] = body.postId === undefined ? [] : [body.postId];
  if (body.postIds !== undefined) {
    if (!Array.isArray(body.postIds)) {
      return json({ error: '`postIds` must be an array of post ids' }, 400);
    }
    ids.push(...body.postIds);
  }
  if (ids.some((id) => !/^\d+$/.test(String(id)))) {
    return json({ error: '`postId` and `postIds` must be positive integers' }, 400);
  }

  // Bound the *inputs*, not the tag set they expand into: 50 ids expand to 51
  // tags, and a cap read off the expansion would reject the batch WordPress is
  // allowed to send.
  if (ids.length > MAX_ITEMS || requestedTags.length > MAX_ITEMS || requestedPaths.length > MAX_ITEMS) {
    return json({ error: `at most ${MAX_ITEMS} post ids, ${MAX_ITEMS} tags and ${MAX_ITEMS} paths per request` }, 400);
  }

  const tags = new Set(requestedTags);
  for (const id of ids) {
    tags.add(postTag(id as number | string));
  }
  if (ids.length > 0) {
    // The posts' own listings — /news/, the catalogue, the home feed — hold a
    // copy of each title and thumbnail, so they go stale with them.
    tags.add(WP_TAGS.posts);
  }

  // Confined to this project's namespace. Next's implicit route tags (`_N_T_/…`)
  // are addressable through the same API, and accepting them would turn a
  // leaked secret into a purge of the entire render cache.
  const foreign = [...tags].filter((tag) => !isWpTag(tag));
  if (foreign.length > 0) {
    return json({ error: `only ${WP_TAGS.all}* tags may be revalidated`, rejected: foreign }, 400);
  }

  const paths = requestedPaths.filter((path) => path.startsWith('/'));
  if (paths.length !== requestedPaths.length) {
    return json({ error: '`paths` must be absolute route paths beginning with /' }, 400);
  }

  if (tags.size === 0 && paths.length === 0) {
    // A bodiless POST meaning «something changed» would have to purge
    // everything; make the caller say so with `{"tags":["wp"]}` instead.
    return json({ error: 'nothing to revalidate — pass postId, postIds, tags or paths' }, 400);
  }

  for (const tag of tags) {
    // `{ expire: 0 }` rather than a named profile: every built-in profile
    // (including 'max') only marks the entry stale, which serves the *old* page
    // once more while it rebuilds — precisely the "I published, where is it?"
    // this route exists to remove. The one-argument form does expire
    // immediately but is deprecated in Next 16. `updateTag` is Server
    // Actions-only and throws in a route handler.
    revalidateTag(tag, { expire: 0 });
  }
  const purgedPaths = paths.flatMap(pathVariants);
  for (const path of purgedPaths) {
    revalidatePath(path);
  }

  return json({ revalidated: { tags: [...tags], paths: purgedPaths } }, 200);
};

/** Everything else: this endpoint mutates cache state, so it is POST-only. */
export const GET = async (): Promise<Response> => json({ error: 'method not allowed — POST a JSON body' }, 405);
