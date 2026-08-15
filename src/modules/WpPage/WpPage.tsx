import { ImagePreviewClient } from '@/modules/News/ImagePreview';
import { parsePost, resolveContentImages } from '@/modules/News/utils';
import { canonicalUrl } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
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
 * pipeline (`resolveContentImages` → `parsePost` → `GutenbergProvider`), no
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
  const parsed = parsePost(await resolveContentImages(page.contentHtml));

  return (
    <Box display="flex" flexDirection="column" gap={40} py={48}>
      <PageHeader title={page.title} breadcrumbs={[{ label: 'Главная', href: '/' }, { label: page.title }]} />

      {/* `parsePost` lifts a leading carousel or gallery out of the body; on a
          page there is nothing else to do with it but put it back on top. */}
      {parsed.header && (
        <ImagePreviewClient>
          <GutenbergProvider>{parsed.header}</GutenbergProvider>
        </ImagePreviewClient>
      )}

      <ImagePreviewClient>
        <GutenbergProvider as="section">{parsed.body}</GutenbergProvider>
      </ImagePreviewClient>
    </Box>
  );
};
