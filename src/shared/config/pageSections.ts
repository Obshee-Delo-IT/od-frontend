import type { BreadcrumbItem } from '@/shared/ui/components/Breadcrumbs';
import type { TabItem } from '@/shared/ui/components/Tabs';

/**
 * The WordPress pages that are a **tabbed pair** rather than a page on their
 * own — Figma `team-1` (`706:1584`), D3.
 *
 * `WpPage` draws every page the same way: the WP title as the H1 and
 * «Главная › <that title>» above it. Two pages need more than that, and neither
 * fact is derivable from WordPress:
 *
 * - **The tab strip.** «Команда организации» and «Наблюдательный совет» are two
 *   separate pages in WP, with no relation between them — `/team/` sits at the
 *   root and `/about/supervisory/` under `/about/`, so not even the hierarchy
 *   pairs them. The mock draws them as one section with two tabs.
 * - **The H1.** Figma's heading is «КОМАНДА» while the WP title is «Команда
 *   организации», because in the mock that longer name is what the *tab* says.
 *   Repeating it in the heading above the tab that carries it reads as a stutter.
 *
 * So this is a table of two, not a mechanism. A page that is missing from it
 * renders exactly as before.
 *
 * **The breadcrumbs are a deliberate superset of the mock**, which starts the
 * trail at «О нас». Every other page on this site starts at «Главная», and one
 * page quietly dropping it would be the odd one out — the parent crumb the mock
 * adds is what matters, and it is here. (Design still owes an answer on which
 * convention wins site-wide; see `docs/next-steps.md`.)
 */
export interface PageSection {
  /** Replaces the WP title in the H1 only — metadata and `<title>` keep the real one. */
  title?: string;
  /** The full trail, the page's own crumb included. */
  breadcrumbs: BreadcrumbItem[];
  tabs: TabItem[];
  /** `value` of this page's own tab. */
  activeValue: string;
}

const ABOUT_TABS: TabItem[] = [
  { label: 'Команда организации', value: 'team', href: '/team/' },
  { label: 'Наблюдательный совет', value: 'supervisory', href: '/about/supervisory/' },
];

const ABOUT_CRUMBS: BreadcrumbItem[] = [
  { label: 'Главная', href: '/' },
  { label: 'О нас', href: '/about/' },
];

/** Keyed by the path the page is served at, trailing slash included. */
export const PAGE_SECTIONS: Record<string, PageSection> = {
  '/team/': {
    title: 'Команда',
    breadcrumbs: [...ABOUT_CRUMBS, { label: 'Команда' }],
    tabs: ABOUT_TABS,
    activeValue: 'team',
  },
  '/about/supervisory/': {
    title: 'Наблюдательный совет',
    breadcrumbs: [...ABOUT_CRUMBS, { label: 'Наблюдательный совет' }],
    tabs: ABOUT_TABS,
    activeValue: 'supervisory',
  },
};

export const resolvePageSection = (path: string): PageSection | null => PAGE_SECTIONS[path] ?? null;
