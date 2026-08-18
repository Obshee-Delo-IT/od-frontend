import OdPro from '@/shared/ui/assets/illustrations/direction-2.svg';
import OnlineCourses from '@/shared/ui/assets/illustrations/direction-3.svg';
import Video from '@/shared/ui/assets/illustrations/direction-5.svg';
import HealthyKids from '@/shared/ui/assets/illustrations/healthy-kids.svg';
import HealthyRussia from '@/shared/ui/assets/illustrations/healthy-russia.svg';
import HealthyYouth from '@/shared/ui/assets/illustrations/healthy-youth.svg';
import type { FC, SVGProps } from 'react';

/**
 * The «Программы» and «Направления деятельности» cards of the **home page**.
 *
 * Editorial data with nothing behind it in WordPress — the `project` CPT is 21
 * Lorem-ipsum drafts (see `docs/implementation-notes.md` D6) — so the home
 * carousel's list lives here, where hiding a card or repointing one is a config
 * edit rather than a route edit.
 *
 * **`/projects/` no longer reads this.** That page was a native route over these
 * same arrays until D6g, when it became the WordPress page it has always had a
 * URL for; its cards are blocks now, written once by `od_pages_projects()` and
 * edited in the admin. So the same six cards exist in two places and can drift:
 * a card added here appears on the home page only, and one added in the admin
 * appears on `/projects/` only. That is the price of the page being editable
 * without a deploy — when they disagree, the admin is the one a reader sees on
 * the page whose subject is the list.
 *
 * **Each card carries its own drawing**, because Figma pairs them by name and
 * not by position: «Общее дело ПРО» is the charts illustration wherever it
 * appears, even though it is the 4th card here and the 1st of its section on
 * `/projects/`. The five `direction-*.svg` names are positional leftovers; the
 * file each constant below points at is what matters. `/projects/` keeps its own
 * copies of the same six under `public/figma/projects/`, named by card id —
 * CSS cannot import an SVG that `@svgr/webpack` turns into a component.
 *
 * **Programme hrefs address the pages WordPress already serves.** The real
 * programmes are three top-level pages (`/healthy-kids/`, not
 * `/programs/healthy-children/`, which 404s upstream; the `/programs/*` forms
 * that resolve at all only 301 onto these). All three render natively from WP at
 * those same URLs rather than through the A6 iframe, which is the default for
 * any WP page — nothing here changes either way.
 */

/** Shape the card components accept. */
interface SectionCardData {
  id: string;
  title: string;
  href: string;
  Illustration: FC<SVGProps<SVGElement>>;
}

export const PROGRAMS: SectionCardData[] = [
  { id: 'healthy-russia', title: 'Здоровая Россия', href: '/healthy-russia/', Illustration: HealthyRussia },
  { id: 'healthy-kids', title: 'Здоровые дети', href: '/healthy-kids/', Illustration: HealthyKids },
  { id: 'healthy-youth', title: 'Здоровая молодёжь', href: '/healthy-youth/', Illustration: HealthyYouth },
];

/**
 * Three more are drawn in Figma and absent here — «Бизнес-клуб»
 * (`/projects/business-club/`), «ОД ИТ» (`/projects/od-it/`) and
 * «Наставничество» (`/projects/mentorship/`). All three 404 on the legacy origin
 * (measured 2026-08-14), so the A6 fallback has nothing to embed for them
 * either. Add the card back when its page exists — one line for the home page,
 * and a card in the admin for `/projects/` — their drawings are already in the
 * repo as `direction-1.svg` (Бизнес-клуб), `direction-3.svg` (ОД ИТ) and
 * `direction-4.svg` (Наставничество).
 *
 * «Онлайн курсы» is not in the mock at all and borrows «ОД ИТ»'s drawing, which
 * Figma names «Digital learning». Restoring «ОД ИТ» therefore needs a drawing of
 * its own, or the two cards share one component and duplicate the SVG's ids.
 */
export const DIRECTIONS: SectionCardData[] = [
  { id: 'od-pro', title: 'Общее дело ПРО', href: 'https://od-pro.ru', Illustration: OdPro },
  { id: 'video', title: 'Видеоматериалы', href: '/video/', Illustration: Video },
  { id: 'online-courses', title: 'Онлайн курсы', href: 'https://edu.obshee-delo.ru/', Illustration: OnlineCourses },
];

/** Heading above the home page's first carousel, when the two are split. */
export const PROGRAMS_TITLE = 'Программы';

/** Heading above the second one. */
export const DIRECTIONS_TITLE = 'Направления деятельности';

/**
 * Heading for the **merged** home carousel, used only while the directions are
 * too few to stand alone. Programmes come first, as the wording says.
 */
export const HOME_SECTIONS_TITLE = 'Программы и направления деятельности';

/**
 * Whether the home page draws Figma's two carousels — «Программы» and
 * «Направления деятельности» — instead of folding them into one.
 *
 * They were merged because three of the five directions have no page to point
 * at, and a two-card carousel reads as a stub above the fold. Three is where it
 * stops being a stub: a full row, the same count the carousel shows at desktop.
 * So the split comes back on its own as directions are added, and would fold
 * again if they were removed — no second switch to remember.
 */
export const SPLIT_HOME_SECTIONS = DIRECTIONS.length >= 3;
