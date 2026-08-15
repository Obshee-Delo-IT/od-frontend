import OdPro from '@/shared/ui/assets/illustrations/direction-2.svg';
import OnlineCourses from '@/shared/ui/assets/illustrations/direction-3.svg';
import Video from '@/shared/ui/assets/illustrations/direction-5.svg';
import HealthyKids from '@/shared/ui/assets/illustrations/healthy-kids.svg';
import HealthyRussia from '@/shared/ui/assets/illustrations/healthy-russia.svg';
import HealthyYouth from '@/shared/ui/assets/illustrations/healthy-youth.svg';
import type { FC, SVGProps } from 'react';

/**
 * The «Программы» and «Направления деятельности» cards, shared by the home page
 * and `/projects/` (D6).
 *
 * Editorial data with nothing behind it in WordPress — the `project` CPT is 21
 * Lorem-ipsum drafts (see `docs/implementation-notes.md` D6) — so the list lives
 * here, where hiding a card or repointing one is a config edit rather than a
 * route edit. **Both surfaces read the same two arrays**, so a card hidden here
 * is hidden on both; they differ only in shape — the home page folds them into
 * one carousel, `/projects/` keeps the two sections its mock draws.
 *
 * **Each card carries its own drawing**, because Figma pairs them by name and
 * not by position: «Общее дело ПРО» is the charts illustration on both pages,
 * even though it is the 4th card on one and the 1st of its section on the other.
 * The five `direction-*.svg` names are positional leftovers; the file each
 * constant below points at is what matters.
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
 * either. Add the card back when its page exists — one line, and it appears on
 * the home page and `/projects/` together — their drawings are already in the
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

/**
 * `/projects/`'s H1, and the accessible name of the programme grid under it —
 * that grid draws no heading of its own, because the mock puts one only above
 * «Проекты». The live site and Figma's own nav agree on this label; the Figma
 * *frame* is named `projects`, which is where «Проекты» below comes from.
 */
export const PROGRAMS_TITLE = 'Программы';

/** Heading above the second `/projects/` section. */
export const PROJECTS_TITLE = 'Проекты';

/** The same second section is «Направления деятельности» on the home page. */
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
 * again if they were removed — no second switch to remember. `/projects/` is
 * always split: it is the page whose subject is the list, so a short section
 * there is a list, not a gap.
 */
export const SPLIT_HOME_SECTIONS = DIRECTIONS.length >= 3;
