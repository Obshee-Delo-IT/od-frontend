import { Directions } from '@/modules/Home';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { DIRECTIONS, DIRECTIONS_TITLE, PROGRAMS, PROGRAMS_TITLE } from '@/shared/config/programSections';
import { canonicalUrl } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import type { Metadata } from 'next';

/**
 * `/projects/` (D6) — the index Figma draws as `projects` (`706:1775`).
 *
 * Editorial, not CMS-driven: the cards come from `shared/config/programSections`,
 * the same two arrays the home page reads, so a card hidden there (today
 * «Бизнес-клуб», «ОД ИТ» and «Наставничество», none of which has a page) is
 * hidden on both surfaces. The difference is only the shape — the home page
 * folds the lists into one carousel, this page keeps the two sections the mock
 * draws.
 *
 * No breadcrumbs row: the mock's header omits it here, unlike the per-project
 * pages. Nothing is fetched, so there is no `revalidate` — the route is fully
 * static.
 *
 * Being a real route, this retires the A6 legacy fallback for `/projects/`
 * automatically (App Router precedence over `[...slug]`); the three
 * `/projects/<slug>/` detail mocks stay unbuilt — zero traffic in 91 days.
 */

const TITLE = 'Проекты — ОБЩЕЕ ДЕЛО';
const DESCRIPTION = 'Программы и направления деятельности общероссийской общественной организации «Общее дело»';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonicalUrl('/projects/') },
  openGraph: {
    url: canonicalUrl('/projects/'),
    title: TITLE,
    description: DESCRIPTION,
  },
};

const ProjectsPage = () => (
  <Box display="flex" flexDirection="column" gap={40} py={48}>
    <PageHeader title="Проекты" />

    <Directions title={PROGRAMS_TITLE} directions={PROGRAMS} />
    <Directions title={DIRECTIONS_TITLE} directions={DIRECTIONS} />

    <NewsletterSignup />
  </Box>
);

export default ProjectsPage;
