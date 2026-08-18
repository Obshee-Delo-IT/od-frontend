import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { canonicalUrl } from '@/shared/config/site';
import ArticlesIllustration from '@/shared/ui/assets/illustrations/materials-articles.svg';
import MetodichkiIllustration from '@/shared/ui/assets/illustrations/materials-metodichki.svg';
import PrintedIllustration from '@/shared/ui/assets/illustrations/materials-printed.svg';
import SocialIllustration from '@/shared/ui/assets/illustrations/materials-social.svg';
import { Box } from '@/shared/ui/components/Box';
import { CardSection, type CardData } from '@/shared/ui/components/CardSection';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import type { Metadata } from 'next';

const TITLE = 'Материалы';
const DESCRIPTION =
  'Материалы «Общего дела»: методические пособия, печатная продукция, статьи для газет и журналов и социальная реклама.';

/**
 * The four groups of the Figma `ads` frame (`778:2206`), in its order — which
 * is also the live page's. Each `href` is the address that page links to today,
 * so the section's own navigation survives the cutover unchanged; three of the
 * four are still WP pages and answer through the A6 fallback until their own
 * routes land (D8 Tier 2: `plakati`, `zakladki`, `metodichki`).
 */
const GROUPS: CardData[] = [
  {
    id: 'metodichki',
    title: 'Методические пособия',
    href: '/materials/metodichki/',
    Illustration: MetodichkiIllustration,
  },
  {
    id: 'printed-products',
    title: 'Печатная продукция',
    href: '/materials/printed-products/',
    Illustration: PrintedIllustration,
  },
  {
    id: 'articles',
    title: 'Статьи для газет и журналов',
    href: '/materials/articles/',
    Illustration: ArticlesIllustration,
  },
  {
    id: 'social-reklama',
    title: 'Социальная реклама',
    href: '/materials/social-reklama/',
    Illustration: SocialIllustration,
  },
];

export const generateMetadata = (): Metadata => {
  const url = canonicalUrl('/materials/');
  return {
    title: `${TITLE} — ОБЩЕЕ ДЕЛО`,
    description: DESCRIPTION,
    alternates: { canonical: url },
    openGraph: { url, title: TITLE, description: DESCRIPTION },
  };
};

/**
 * `/materials/` — the section hub (D8).
 *
 * Static, and deliberately so: the page is four links with an illustration
 * each, the same four the live page has carried for years. There is no
 * `material` CPT to read (`wp-backend.md` §8), and inventing one to render a
 * hard-coded quartet would put the content question on the critical path of a
 * page that doesn't ask it. The sub-pages behind these links are where the CMS
 * shape actually matters.
 *
 * The cards are `CardSection`'s, not this route's: four cards fall out as the
 * 2 + 2 wide rows the `ads` mock draws, which is the same card `/projects/`
 * leads «Проекты» with.
 *
 * Worth building ahead of its entry traffic: 107 entries in 91 days against
 * 939 views (8.8×) — almost nobody lands here from search, but it is how the
 * section gets browsed, so it is what an iframe would be seen through.
 */
const Page = () => {
  const breadcrumbItems = [{ label: 'Главная', href: '/' }, { label: TITLE }];

  return (
    <Box display="flex" flexDirection="column" gap={40} pt={20} pb={48}>
      <PageHeader title={TITLE} breadcrumbs={breadcrumbItems} />

      {/* No visible heading — the H1 above already says «Материалы». */}
      <CardSection title={TITLE} cards={GROUPS} showHeading={false} />

      <NewsletterSignup />
    </Box>
  );
};

export default Page;
