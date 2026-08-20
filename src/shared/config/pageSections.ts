import type { BreadcrumbItem } from '@/shared/ui/components/Breadcrumbs';
import type { TabItem } from '@/shared/ui/components/Tabs';

/**
 * The WordPress pages that are a **tabbed pair** rather than a page on their
 * own — Figma `team-1` (`706:1584`), D3, and one more pair added 2026-08-20 by
 * the same reasoning: «Устав» and «Документы» are one thing to a reader and were
 * two cards, two menu items and two headings.
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
 * So this is a table of pairs, not a mechanism. A page that is missing from it
 * renders exactly as before.
 *
 * **The second pair, «Устав и документы», is a merge rather than a mock.** No
 * frame draws it: `/about/ustav/` (charter) and `/about/docs/` (the documents
 * template it shares with `/about/experts-review/`) are separate WordPress pages
 * that a reader has no reason to tell apart, so they now share one card on
 * `/about/` and one item in the WordPress menu, and the tab strip is what picks
 * between them. **Both URLs stay** — each has its own search traffic, and
 * `<title>` and the canonical keep each page's own WP title.
 *
 * The H1 and the last crumb follow the tab, exactly as they do on the first pair:
 * «УСТАВ» on one, «ДОКУМЕНТЫ» on the other, so the page says which of the two the
 * reader is on and «Устав и документы» stays the name of the way in — the card
 * and the menu item. Both are short forms of the WP titles («Устав организации»,
 * and «Документы и отчёты» on production), which is the same reason `/team/` has
 * one.
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

const DOCUMENT_TABS: TabItem[] = [
  { label: 'Устав', value: 'ustav', href: '/about/ustav/' },
  { label: 'Документы', value: 'docs', href: '/about/docs/' },
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
  '/about/ustav/': {
    title: 'Устав',
    breadcrumbs: [...ABOUT_CRUMBS, { label: 'Устав' }],
    tabs: DOCUMENT_TABS,
    activeValue: 'ustav',
  },
  '/about/docs/': {
    title: 'Документы',
    breadcrumbs: [...ABOUT_CRUMBS, { label: 'Документы' }],
    tabs: DOCUMENT_TABS,
    activeValue: 'docs',
  },
};

export const resolvePageSection = (path: string): PageSection | null => PAGE_SECTIONS[path] ?? null;
