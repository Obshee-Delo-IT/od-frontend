import { resolvePageSection } from '@/shared/config/pageSections';
import { canonicalUrl, SITE_NAME } from '@/shared/config/site';
import { paginatedPath, parsePost, resolveContentHtml, resolveQueryPagination } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { Tabs } from '@/shared/ui/components/Tabs';
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
  /** The page's own path — the canonical URL, unchanged from the old site. */
  path: string;
  /**
   * Which page of the body's `core/query` block is being shown, from the
   * `/about/smi/page/2/` suffix the route strips off `path` (D3). 1 for every
   * page that has no query block, which is nearly all of them.
   */
  pageNumber?: number;
}

export const wpPageMetadata = ({ page, path, pageNumber = 1 }: WpPageProps): Metadata => {
  // Self-canonical per page, the same rule `/materials/articles/?page=2` follows:
  // page 2 is its own set of posts, so pointing it at page 1 would ask the index
  // to drop content nothing else links to.
  const url = canonicalUrl(paginatedPath(path, pageNumber));
  const description = page.description ?? undefined;
  // The suffix every native route writes into its own title. A WP title is an
  // editor's sentence — «Материалы» on its own is not what a tab should read.
  // The page number goes in it too: 18 pages of `/about/smi/` under one title
  // is a duplicate-title report waiting to happen.
  const title = `${page.title}${pageNumber > 1 ? ` — страница ${pageNumber}` : ''} — ${SITE_NAME}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, locale: 'ru_RU', title, description },
  };
};

export const WpPage = async ({ page, path }: WpPageProps) => {
  /* Two pages are a tabbed pair with a heading of their own — see
     `shared/config/pageSections.ts`. Everything else takes the WP title and
     «Главная › <that title>», which is what this route has always drawn. */
  const section = resolvePageSection(path);

  /* `liftHeader: false` — the hero lift is a news/film layout rule, and applying
     it here only ever destroyed content: it removes the lifted block's whole
     parent, which on a page is the column an editor dropped the gallery into.
     Both od-dev pages that carry one would lose a sibling, and neither has it
     as a leading block, so there is nothing to lift and everything to lose. */
  /* Pagination first: WordPress rendered those hrefs against the REST request it
     was answering, so they address `wp-json` and nobody can follow them. See
     `resolveQueryPagination`. */
  const html = await resolveContentHtml(resolveQueryPagination(page.contentHtml, path), true);
  /* A `/profile/…` link alone in its paragraph is the marker for "draw this
     person here" — the only page↔profile relation WordPress can express, since
     it has neither a meta field nor a shared taxonomy for one. See
     `profileEmbeds.tsx`. */
  const parsed = parsePost(html, { liftHeader: false, embeds: await resolveProfileEmbeds(html) });

  return (
    <Box display="flex" flexDirection="column" gap={40} pt={20} pb={48}>
      {/* «Главная → …parents → this page». The mocks for sub-pages start at the
          parent («Материалы → Печатная продукция»); keeping «Главная» in front
          is a superset of that and of every native route's trail. A page in a
          tabbed section names its own trail instead — `/team/` sits at the WP root
          and belongs under «О нас» anyway, so the hierarchy cannot supply it. */}
      <PageHeader
        title={section?.title ?? page.title}
        breadcrumbs={
          section?.breadcrumbs ?? [
            { label: 'Главная', href: '/' },
            ...page.ancestors.map((ancestor) => ({ label: ancestor.title, href: ancestor.href })),
            { label: page.title },
          ]
        }
        tabs={section && <Tabs items={section.tabs} activeValue={section.activeValue} aria-label="Разделы «О нас»" />}
      />

      <ImagePreviewClient>
        <GutenbergProvider as="section">{parsed.body}</GutenbergProvider>
      </ImagePreviewClient>
    </Box>
  );
};
