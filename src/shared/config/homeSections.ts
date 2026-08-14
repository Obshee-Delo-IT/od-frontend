/**
 * The home page's «Программы» and «Направления деятельности» cards.
 *
 * Editorial data with nothing behind it in WordPress — the `project` CPT is 21
 * Lorem-ipsum drafts (see `docs/implementation-notes.md` D6) — so the list lives
 * here, where hiding a card or repointing one is a config edit rather than a
 * route edit.
 *
 * **Programme hrefs address the legacy pages the A6 fallback embeds.** The real
 * programmes are three top-level pages on the old site (`/healthy-kids/`, not
 * `/programs/healthy-children/`, which 404s upstream; the `/programs/*` forms
 * that resolve at all only 301 onto these, and the fallback route doesn't follow
 * redirects). Adding a native route for one of them retires its fallback with no
 * edit here — App Router precedence handles it.
 */

/** Shape both `Directions` and `Programs` cards accept. */
export interface HomeCardData {
  id: string;
  title: string;
  href: string;
}

/**
 * Directions with nowhere to point: all three 404 on the legacy origin (measured
 * 2026-08-14), so the fallback has nothing to embed either. Drop a title from
 * this set once its page exists.
 */
const HIDDEN_DIRECTIONS = new Set(['Бизнес-клуб', 'ОД ИТ', 'Наставничество']);

export const HOME_PROGRAMS: HomeCardData[] = [
  { id: 'healthy-russia', title: 'Здоровая Россия', href: '/healthy-russia/' },
  { id: 'healthy-kids', title: 'Здоровые дети', href: '/healthy-kids/' },
  { id: 'healthy-youth', title: 'Здоровая молодёжь', href: '/healthy-youth/' },
];

const ALL_DIRECTIONS: HomeCardData[] = [
  { id: 'business-club', title: 'Бизнес-клуб', href: '/projects/business-club/' },
  { id: 'od-pro', title: 'Общее дело ПРО', href: 'https://od-pro.ru' },
  { id: 'od-it', title: 'ОД ИТ', href: '/projects/od-it/' },
  { id: 'mentorship', title: 'Наставничество', href: '/projects/mentorship/' },
  { id: 'video', title: 'Видеоматериалы', href: '/video/' },
];

export const HOME_DIRECTIONS: HomeCardData[] = ALL_DIRECTIONS.filter((card) => !HIDDEN_DIRECTIONS.has(card.title));

/** Below this a carousel reads as a stub — three is one full row on desktop. */
const MIN_CARDS = 3;

/** Whether the two carousels collapse into one under {@link HOME_SECTIONS_TITLE}. */
export const shouldMergeHomeSections = (programs: number, directions: number): boolean =>
  programs < MIN_CARDS || directions < MIN_CARDS;

export const MERGE_HOME_SECTIONS = shouldMergeHomeSections(HOME_PROGRAMS.length, HOME_DIRECTIONS.length);

/** Heading for the merged section. Programmes come first, as the wording says. */
export const HOME_SECTIONS_TITLE = 'Программы и направления деятельности';
