import { resolveContentAssets } from './resolveContentAssets';
import { resolveContentLinks } from './resolveContentLinks';
import { resolveHeadingCase } from './resolveHeadingCase';

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
 *
 * {@link resolveHeadingCase} rides along because it is the same kind of pass —
 * a fact about WordPress's own output that every body needs fixing, in one place
 * rather than per route.
 */
export const resolveContentHtml = async (html?: string | null, eagerFirstImage = false): Promise<string> =>
  resolveHeadingCase(resolveContentLinks(await resolveContentAssets(html, eagerFirstImage)));
