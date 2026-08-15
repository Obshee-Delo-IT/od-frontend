import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { DIRECTIONS, PROGRAMS, PROGRAMS_TITLE, PROJECTS_TITLE } from '@/shared/config/programSections';
import { canonicalUrl } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
import { CardSection } from '@/shared/ui/components/CardSection';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import type { Metadata } from 'next';

/**
 * `/projects/` (D6) — the index Figma draws as `projects` (`706:1775`).
 *
 * Editorial, not CMS-driven: the cards come from `shared/config/programSections`,
 * the same two arrays the home page reads, so a card hidden there (today
 * «Бизнес-клуб», «ОД ИТ» and «Наставничество», none of which has a page) is
 * hidden here too. The difference is only the shape — the home page folds the
 * lists into one carousel, this page keeps the two sections the mock draws, as
 * static grids.
 *
 * Both card shapes the mock draws are built, and which one a row gets is derived
 * rather than authored: `toCardRows` fills rows of three and spends the
 * remainder on the wide 598×280 pair the mock leads «Проекты» with. So the
 * five cards of the mock still read 2 + 3, and hiding or restoring one card
 * re-flows the page instead of stranding a row of one.
 *
 * No breadcrumbs row: the mock's header omits it here, unlike the per-project
 * pages. Nothing is fetched, so there is no `revalidate` — the route is fully
 * static.
 *
 * Being a real route, this retires the A6 legacy fallback for `/projects/`
 * automatically (App Router precedence over `[...slug]`); the three
 * `/projects/<slug>/` detail mocks stay unbuilt — zero traffic in 91 days.
 */

const TITLE = 'Программы — ОБЩЕЕ ДЕЛО';
const DESCRIPTION = 'Программы и проекты общероссийской общественной организации «Общее дело»';

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
    <PageHeader title={PROGRAMS_TITLE} />

    {/* No visible heading — the H1 above already says «Программы». */}
    <CardSection title={PROGRAMS_TITLE} cards={PROGRAMS} showHeading={false} />
    <CardSection title={PROJECTS_TITLE} cards={DIRECTIONS} />

    <NewsletterSignup />
  </Box>
);

export default ProjectsPage;
