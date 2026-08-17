import { resolveContentImages } from './resolveContentImages';
import { resolveContentLinks } from './resolveContentLinks';

/**
 * The full rewrite pass over a WordPress body — every URL WordPress rendered
 * against its own origin, turned into one this site serves.
 *
 * This is the pipeline's entry point, ahead of `parsePost`: use it rather than
 * either half, so a body can't reach the page with only its images fixed. The
 * order matters only in that images resolve asynchronously (a HEAD probe per
 * source) while links are pure string work.
 */
export const resolveContentHtml = async (html?: string | null): Promise<string> =>
  resolveContentLinks(await resolveContentImages(html));
