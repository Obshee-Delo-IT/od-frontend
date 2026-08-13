const normalise = (path: string): string => {
  const withoutQuery = path.split(/[?#]/)[0];
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

/**
 * Does this nav item own the current URL?
 *
 * Figma highlights the current section in both the desktop nav (`brand/red/6`
 * fill, bold label) and the mobile menu (`brand/red/8` label) — `header-v2`
 * ships with ВИДЕО lit. Matching is by section prefix, so `/video/filmy/` and a
 * film's `/28749/` both light ВИДЕО… except that only works for paths the item
 * actually prefixes; a bare post id has no section in its URL and lights
 * nothing, which is the honest answer.
 *
 * Absolute (external) hrefs never match — they leave the site. `/` matches only
 * the home page, or every page would claim ГЛАВНАЯ.
 */
export const isNavItemActive = (pathname: string, href: string): boolean => {
  if (!href || /^https?:\/\//i.test(href)) {
    return false;
  }

  const current = normalise(pathname);
  const target = normalise(href);

  if (target === '/') {
    return current === '/';
  }

  return current === target || current.startsWith(`${target}/`);
};
