/**
 * The extra breadcrumb crumb for a page whose URL is flatter than its place in
 * the site.
 *
 * Every asset page under `/materials/` is a **child of `/materials/` in
 * WordPress** — `post_parent` is 20225 for all ten — while the section reads as
 * two hubs with five pages each, which is what the mocks draw in their
 * breadcrumbs («Материалы → Печатная продукция → Наши книги») and what the hub
 * cards say by linking there.
 *
 * **Reparenting them in WordPress is not the fix.** A page's permalink is its
 * ancestors' slugs plus its own, so moving `plakati` under `social-reklama`
 * turns `/materials/plakati/` into `/materials/social-reklama/plakati/` — and
 * that URL is the #6 entry page on the whole site. The tree is flat on purpose;
 * only the trail above the page is wrong, and only in the one place a reader
 * sees it.
 *
 * So the relation lives here, as ten lines of the same kind as
 * `legacyRedirects` and `newsCategories`: paths, not ids, and nothing
 * environment-specific. Adding a sixth page to a hub means adding it here as
 * well as to the hub's cards — the alternative was a postmeta field and an
 * mu-plugin to expose it, for a set that has not changed since 2017.
 */

interface SectionHub {
  title: string;
  href: string;
  children: string[];
}

const HUBS: SectionHub[] = [
  {
    title: 'Печатная продукция',
    href: '/materials/printed-products/',
    children: [
      '/materials/books/',
      '/materials/zakladki/',
      '/materials/booklet/',
      '/materials/disk/',
      '/materials/autosticker/',
    ],
  },
  {
    title: 'Социальная реклама',
    href: '/materials/social-reklama/',
    children: [
      '/materials/plakati/',
      '/materials/billboards/',
      '/materials/audio-roliki-social-reklama/',
      '/materials/led-board-roliki/',
      '/materials/sticker/',
    ],
  },
];

export interface SectionParent {
  title: string;
  href: string;
}

const BY_CHILD = new Map<string, SectionParent>(
  HUBS.flatMap((hub) => hub.children.map((child) => [child, { title: hub.title, href: hub.href }] as const))
);

/**
 * The hub `path` belongs to, or `null` when its WordPress parent is already the
 * whole trail — which is every other page on the site.
 *
 * `path` is expected with both slashes, the form the catch-all resolves.
 */
export const sectionParent = (path: string): SectionParent | null => BY_CHILD.get(path) ?? null;
