/**
 * Per-destination corrections applied to the WordPress main navigation.
 *
 * The menu is editorial data — editors own it in WP — but a handful of entries
 * point at addresses that are stale, or at properties this site deliberately
 * doesn't advertise. Rather than fork the menu, each destination gets an
 * override below and `toNavItems` applies it on the way through.
 *
 * **An override lists every host its destination is known by.** That plural is
 * the whole point: the same nav entry carries a *different* URL on each
 * WordPress install, so an override keyed on one spelling quietly stops applying
 * the moment `WP_BASE` is repointed — which is the migration this project is
 * planning for. Menu-item ids would be worse still; they are per-install by
 * definition, the trap `filmCategories.ts` documents. Hosts may be written in
 * Unicode, and are normalised to Punycode at load, so `общеедело-про.рф` also
 * matches the `xn--` spelling WordPress sometimes stores.
 *
 * ⚠️ **An override that matches nothing fails open** — the entry reappears in
 * the header carrying its uncorrected URL, and nothing errors. So repointing
 * `WP_BASE` at a new install means re-reading `/wp/v2/menu-items` and checking
 * every `hosts` list still matches, exactly like the film category ids.
 */
export type NavOverride = {
  /** Every host this destination is reachable at — installs disagree, see above. */
  hosts: string[];
  /** Replaces the WordPress URL. Relative paths and absolute URLs both work. */
  href?: string;
  /** Keep the entry — and, being top-level, its children — out of the nav. */
  hidden?: boolean;
};

/**
 * Whether «ОБЩЕЕДЕЛО-ПРО» appears in the header. Suppressed for now — the PRO
 * property isn't one this site advertises yet — and this is the one switch that
 * brings it back. Its destination is corrected either way, so flipping this to
 * `true` needs no other edit.
 */
export const SHOW_PRO_IN_NAV: boolean = false;

const OVERRIDES: NavOverride[] = [
  {
    // «ОБЩЕЕДЕЛО-ПРО» — the sibling PRO property, and the reason `hosts` is a
    // list. All three addresses were probed 2026-08-13:
    //   общеедело-про.рф    what od-dev's menu carries; DNS no longer resolves
    //   od-pro.ru           what *prod's* menu carries; live, but it serves
    //                       «Всероссийский конкурс социальных проектов» — the
    //                       contest landing, a different site
    //   pro.obshee-delo.ru  the property itself, «В начало | ОбщееДелоПРО»
    // Correcting all three is what makes unhiding safe on either install.
    hosts: ['общеедело-про.рф', 'od-pro.ru', 'pro.obshee-delo.ru'],
    href: 'https://pro.obshee-delo.ru/',
    hidden: !SHOW_PRO_IN_NAV,
  },
];

const toHostname = (value: string): string | null => {
  try {
    return new URL(value.includes('//') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const overridesByHost = new Map<string, NavOverride>(
  OVERRIDES.flatMap((override) =>
    override.hosts.flatMap((host) => {
      const hostname = toHostname(host);
      return hostname ? [[hostname, override] as const] : [];
    })
  )
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
  return hostname ? overridesByHost.get(hostname) : undefined;
};
