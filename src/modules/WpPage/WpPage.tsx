import { canonicalUrl, SITE_NAME } from '@/shared/config/site';
import { parsePost, resolveContentHtml } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { GutenbergProvider } from '@/shared/ui/theme';
import { resolveProfileEmbeds } from './profileEmbeds';
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
  // The suffix every native route writes into its own title. A WP title is an
  // editor's sentence — «Материалы» on its own is not what a tab should read.
  const title = `${page.title} — ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, locale: 'ru_RU', title, description },
  };
};

export const WpPage = async ({ page }: WpPageProps) => {
  /* `liftHeader: false` — the hero lift is a news/film layout rule, and applying
     it here only ever destroyed content: it removes the lifted block's whole
     parent, which on a page is the column an editor dropped the gallery into.
     Both od-dev pages that carry one would lose a sibling, and neither has it
     as a leading block, so there is nothing to lift and everything to lose. */
  const html = await resolveContentHtml(page.contentHtml, true);
  /* A `/profile/…` link alone in its paragraph is the marker for "draw this
     person here" — the only page↔profile relation WordPress can express, since
     it has neither a meta field nor a shared taxonomy for one. See
     `profileEmbeds.tsx`. */
  const parsed = parsePost(html, { liftHeader: false, embeds: await resolveProfileEmbeds(html) });

  return (
    <Box display="flex" flexDirection="column" gap={40} pt={20} pb={48}>
      {/* «Главная → …parents → this page». The mocks for sub-pages start at the
          parent («Материалы → Печатная продукция»); keeping «Главная» in front
          is a superset of that and of every native route's trail. */}
      <PageHeader
        title={page.title}
        breadcrumbs={[
          { label: 'Главная', href: '/' },
          ...page.ancestors.map((ancestor) => ({ label: ancestor.title, href: ancestor.href })),
          { label: page.title },
        ]}
      />

      <ImagePreviewClient>
        <GutenbergProvider as="section">{parsed.body}</GutenbergProvider>
      </ImagePreviewClient>
    </Box>
  );
};
