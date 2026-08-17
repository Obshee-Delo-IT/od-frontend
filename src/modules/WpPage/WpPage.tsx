import { canonicalUrl } from '@/shared/config/site';
import { parsePost, resolveContentHtml } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { GutenbergProvider } from '@/shared/ui/theme';
import type { WpPageContent } from '@/shared/api/fetchWpPage';
import type { Metadata } from 'next';

/**
 * A WordPress `page` rendered natively at its own URL (D6) — the body of every
 * WP page the catch-all reaches, bar the exceptions pinned to the legacy iframe
 * in `shared/config/legacyEmbedPages.ts`.
 *
 * Structurally a news article without the news furniture: same Gutenberg
 * pipeline (`resolveContentHtml` → `parsePost` → `GutenbergProvider`), no
 * date, no similar-posts rail, and a `PageHeader` on top because a WP page
 * carries its title outside the body — the post body supplies its own.
 */

export interface WpPageProps {
  page: WpPageContent;
  /** The path it was reached at — the canonical URL, unchanged from the old site. */
  path: string;
}

export const wpPageMetadata = ({ page, path }: WpPageProps): Metadata => {
  const url = canonicalUrl(path);
  const description = page.description ?? undefined;

  return {
    title: page.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, locale: 'ru_RU', title: page.title, description },
  };
};

export const WpPage = async ({ page }: WpPageProps) => {
  /* `liftHeader: false` — the hero lift is a news/film layout rule, and applying
     it here only ever destroyed content: it removes the lifted block's whole
     parent, which on a page is the column an editor dropped the gallery into.
     Both od-dev pages that carry one would lose a sibling, and neither has it
     as a leading block, so there is nothing to lift and everything to lose. */
  const parsed = parsePost(await resolveContentHtml(page.contentHtml), { liftHeader: false });

  return (
    <Box display="flex" flexDirection="column" gap={40} py={48}>
      <PageHeader title={page.title} breadcrumbs={[{ label: 'Главная', href: '/' }, { label: page.title }]} />

      <ImagePreviewClient>
        <GutenbergProvider as="section">{parsed.body}</GutenbergProvider>
      </ImagePreviewClient>
    </Box>
  );
};
