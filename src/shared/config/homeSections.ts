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

/** Shape the `Directions` cards accept. */
interface HomeCardData {
  id: string;
  title: string;
  href: string;
}

export const HOME_PROGRAMS: HomeCardData[] = [
  { id: 'healthy-russia', title: 'Здоровая Россия', href: '/healthy-russia/' },
  { id: 'healthy-kids', title: 'Здоровые дети', href: '/healthy-kids/' },
  { id: 'healthy-youth', title: 'Здоровая молодёжь', href: '/healthy-youth/' },
];

/**
 * Three more are drawn in Figma and absent here — «Бизнес-клуб»
 * (`/projects/business-club/`), «ОД ИТ» (`/projects/od-it/`) and
 * «Наставничество» (`/projects/mentorship/`). All three 404 on the legacy origin
 * (measured 2026-08-14), so the A6 fallback has nothing to embed for them
 * either. Add the card back when its page exists.
 */
export const HOME_DIRECTIONS: HomeCardData[] = [
  { id: 'od-pro', title: 'Общее дело ПРО', href: 'https://od-pro.ru' },
  { id: 'video', title: 'Видеоматериалы', href: '/video/' },
];

/**
 * Heading for the one carousel the home page ships. Programmes come first, as
 * the wording says.
 *
 * Figma draws two carousels — «Программы» and «Направления деятельности» — and
 * this merges them, because three of the five directions have no page to point
 * at and a two-card carousel reads as a stub. If those pages ship and the split
 * comes back, it is one component rendered twice with different props; there
 * was a second, byte-identical copy of `Directions` here for a while and it was
 * never worth its own file.
 */
export const HOME_SECTIONS_TITLE = 'Программы и направления деятельности';
