/**
 * Per-destination corrections applied to the WordPress main navigation.
 *
 * The menu is editorial data — editors own it in WP — but a handful of entries
 * are wrong in ways an editor can't fix from here, or point at properties this
 * site deliberately doesn't advertise. Rather than fork the menu, each stale
 * **destination** gets an entry below and `toNavItems` applies it on the way
 * through.
 *
 * **Keyed by host, not by menu-item id.** Item ids are per-install, so an
 * id-keyed table would need re-checking on every `WP_BASE` repoint (the trap
 * `filmCategories.ts` documents); a host survives that, survives a retitle, and
 * says what the rule is actually about. Keys may be written in Unicode — they
 * are normalised to Punycode at load, so `общеедело-про.рф` also matches the
 * `xn--` spelling WordPress sometimes stores.
 */
export type NavOverride = {
  /** Replaces the WordPress URL. Relative paths and absolute URLs both work. */
  href?: string;
  /** Keep the item — and, being top-level, its children — out of the nav. */
  hidden?: boolean;
};

const OVERRIDES_BY_HOST: Record<string, NavOverride> = {
  // «ОБЩЕЕДЕЛО-ПРО» — the sibling PRO property. It moved to a subdomain, so
  // the address WordPress carries is dead; it's also not a top-level section of
  // this site, so it is corrected *and* dropped from the nav. The home page's
  // own PRO links are separate and unaffected.
  'общеедело-про.рф': { href: 'https://pro.obshee-delo.ru/', hidden: true },
};

const toHostname = (value: string): string | null => {
  try {
    return new URL(value.includes('//') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const overrides = new Map(
  Object.entries(OVERRIDES_BY_HOST).flatMap(([host, override]) => {
    const hostname = toHostname(host);
    return hostname ? [[hostname, override] as const] : [];
  })
);

/**
 * The override for a menu URL, or `undefined` when it needs none. Relative URLs
 * carry no host and so are always left alone.
 */
export const resolveNavOverride = (url: string): NavOverride | undefined => {
  if (!url || !/^https?:\/\//i.test(url)) {
    return undefined;
  }

  const hostname = toHostname(url);
  return hostname ? overrides.get(hostname) : undefined;
};
