/**
 * Turn a WordPress menu URL into a link this site can serve.
 *
 * WP stores main-navigation items as **absolute** URLs against its own origin
 * (`https://od-dev.tmweb.ru/video/`). Rendered as-is, every nav click walks the
 * visitor off the frontend and onto the WordPress host — which on prod is the
 * old site. Editors also mix in relative paths (`/materials/`) and genuinely
 * external destinations (`https://pro.obshee-delo.ru`), so this only strips the
 * origin when it is one of ours.
 *
 * Internal = the WordPress origin (`WP_BASE`) or the site's own public origin
 * (`SITE_URL`). Anything else is returned untouched, and an unparseable value
 * is passed through rather than dropped.
 */
export const toInternalHref = (url: string, internalOrigins: string[]): string => {
  if (!url || !/^https?:\/\//i.test(url)) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const isInternal = internalOrigins.some((origin) => {
    try {
      return Boolean(origin) && new URL(origin).origin === parsed.origin;
    } catch {
      return false;
    }
  });

  if (!isInternal) {
    return url;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};
