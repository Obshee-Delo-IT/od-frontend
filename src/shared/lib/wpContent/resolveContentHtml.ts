import { resolveContentAssets } from './resolveContentAssets';
import { resolveContentLinks } from './resolveContentLinks';

/**
 * The full rewrite pass over a WordPress body — every URL WordPress rendered
 * against its own origin, turned into one this site serves.
 *
 * This is the pipeline's entry point, ahead of `parsePost`: use it rather than
 * either half, so a body can't reach the page with only its images fixed. The
 * order matters only in that images resolve asynchronously (a HEAD probe per
 * source) while links are pure string work.
 *
 * Pass `eagerFirstImage` for a body that is the page's main content — it is the
 * one whose first image is the LCP candidate. See {@link resolveContentAssets}.
 */
export const resolveContentHtml = async (html?: string | null, eagerFirstImage = false): Promise<string> =>
  resolveContentLinks(await resolveContentAssets(html, eagerFirstImage));
