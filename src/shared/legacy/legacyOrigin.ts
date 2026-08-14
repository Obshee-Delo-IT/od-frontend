import { siteUrl } from '@/shared/config/site';
import { legacyWarn } from './legacyLog';

/**
 * Where the A6 fallback fetches un-redesigned pages from (LCP-001).
 *
 * Live production today, the frozen copy later — the swap is this one env var
 * and no code (decision D1). Only the **origin** is kept: a value carrying a
 * path or a query would otherwise compose into `…/some/path/team/`, and the
 * origin is the only part `legacyPath.ts` can pin against.
 *
 * Absent or unparseable means "the fallback is disabled", never a throw: CI
 * builds with no WP environment at all, exactly as `httpClient.ts` handles the
 * same problem for the REST client.
 */
export const resolveLegacyOrigin = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // A `file:` or `data:` value parses but has no meaningful origin ("null"),
  // and nothing else is a website.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  return url.origin;
};

export const legacyOrigin = resolveLegacyOrigin(process.env.WP_LEGACY_BASE);

if (!legacyOrigin) {
  legacyWarn('WP_LEGACY_BASE missing — legacy fallback disabled');
} else if (legacyOrigin === siteUrl) {
  /**
   * Not fatal, and deliberately not a disable — locally `SITE_URL` is unset and
   * defaults to production, so the two match on every developer's machine while
   * the actual server is `localhost` and nothing recurses.
   *
   * On the deployed site after cutover it is a different matter: this app *is*
   * `obshee-delo.ru`, so a `WP_LEGACY_BASE` still pointing there makes every
   * fallback page fetch itself, embed its own shell, and do it again one frame
   * deeper. The frozen copy has to be a different host, and this line is what
   * says so at boot rather than in an incident.
   */
  legacyWarn(`WP_LEGACY_BASE is the site's own origin (${siteUrl}) — after cutover the fallback would proxy itself`);
}
