import { Text, VisuallyHidden } from '@radix-ui/themes';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { extractFirstImage } from '@/shared/api/extractFirstImage';
import { cachedFetchFeaturedImage } from '@/shared/api/fetchFeaturedImage';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { wpBaseUrl } from '@/shared/api/httpClient';
import { resolveMediaUrl } from '@/shared/api/mediaUrl';
import { buildNewsPreview, stripHtml } from '@/shared/api/newsPreview';
import { canonicalUrl, OG_DEFAULT_IMAGE } from '@/shared/config/site';
import { formatDate } from '@/shared/lib/formatDate';
import { parsePost, resolveContentHtml } from '@/shared/lib/wpContent';
import { Box } from '@/shared/ui/components/Box';
import { Breadcrumbs } from '@/shared/ui/components/Breadcrumbs';
import { ImagePreviewClient } from '@/shared/ui/components/ImagePreview';
import { GutenbergProvider } from '@/shared/ui/theme';
import { SimilarNews } from '../SimilarNews';
import css from './NewsArticle.module.css';
import type { Metadata } from 'next';

interface NewsArticleProps {
  /** WP post id, from the legacy `/<id>` URL. */
  id: string;
}

/**
 * `id` is passed in rather than read off the post because the canonical URL is
 * the legacy `/<id>/` this route was reached by — the same address the sitemap
 * publishes and `/news/<id>` redirects to.
 */
export const newsMetadata = async (
  post: Awaited<ReturnType<typeof cachedFetchNews>>,
  id: string
): Promise<Metadata> => {
  const title = stripHtml(post?.title?.rendered) || undefined;
  // Same source as the film page: WP's excerpt, stripped of markup, falling
  // back to the body for the many posts that have no manual excerpt.
  const description = buildNewsPreview(post?.excerpt?.rendered, post?.content?.rendered) ?? undefined;
  const url = canonicalUrl(`/${id}/`);
  /* The editor's own lead image, with the body's first image only as a fallback.
     Measured on od-stage: **100 of 100 posts carry `featured_media`** (against 1
     of 100 pages), so this is a picture someone chose for the post, where the
     body's first image is whatever the layout happens to open with.

     Both go through the resolution pipeline rather than the raw URL: the
     WordPress origin **301s** an offloaded upload to the Yandex bucket, and a
     social crawler that doesn't follow the hop shows no image at all. */
  const image =
    (await cachedFetchFeaturedImage(post?.featured_media, id)) ??
    (await resolveMediaUrl(extractFirstImage(post?.content?.rendered, wpBaseUrl)));

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      countryName: 'Russia',
      // Open Graph wants the underscore form; `ru-RU` is silently ignored.
      locale: 'ru_RU',
      title,
      description,
      // WP omits the zone designator on its GMT timestamps.
      publishedTime: post?.date_gmt ? `${post.date_gmt}Z` : undefined,
      modifiedTime: post?.modified_gmt ? `${post.modified_gmt}Z` : undefined,
      /* The body's first image rather than `featured_media`: that is an id, and
         resolving it costs a second request on a route that has to stay
         statically generatable — while `content.rendered` is already here, and
         on this site's posts the lead photo is the first thing in it. */
      images: [image ?? OG_DEFAULT_IMAGE],
    },
  };
};

/**
 * The news/article detail page. Lives in the module rather than in `app/`
 * because the canonical URL is the legacy `/<id>` (see A8 in the implementation
 * plan), and that route is a catch-all dispatcher shared with films.
 */
export const NewsArticle = async ({ id }: NewsArticleProps) => {
  const data = await cachedFetchNews(id);

  const [category, region] = data?.categories ?? [];

  const title = stripHtml(data?.title?.rendered);
  const breadcrumbItems = [{ label: 'Главная', href: '/' }, { label: 'Новости', href: '/news' }, { label: title }];

  const parsed = parsePost(await resolveContentHtml(data?.content?.rendered, true));
  const date = formatDate(data?.date);

  return (
    <Box
      pt={{
        mobile: 8,
        smallDesktop: 8,
        desktop: 20,
      }}
      pb={{
        mobile: 32,
        smallDesktop: 32,
        desktop: 64,
      }}
    >
      {/* The design shows the post's title in the breadcrumb trail and nowhere
          else, so the page exposed **no h1 at all** and its first heading was
          «Похожие новости» at h3 — a reader navigating by heading found nothing
          naming the article they had opened (A11Y-01). Hidden rather than drawn:
          where the title appears is the mock's decision, and this is the same
          string the `<title>` and the last crumb already carry. */}
      <VisuallyHidden>
        <h1>{title}</h1>
      </VisuallyHidden>
      <Box
        mb={{
          mobile: 24,
          smallDesktop: 24,
          desktop: 20,
        }}
      >
        <Breadcrumbs items={breadcrumbItems} />
      </Box>
      {/* Only when there is one. A post with no carousel and no gallery shipped
          an empty `<div class="gutenberg">` wearing the slot's 20/24/32px
          bottom margin, i.e. a gap between the breadcrumbs and the date with
          nothing in it (DATA-13). */}
      {parsed.header ? (
        <Box
          mb={{
            mobile: 20,
            smallDesktop: 24,
            desktop: 32,
          }}
        >
          <ImagePreviewClient>
            <GutenbergProvider>{parsed.header}</GutenbergProvider>
          </ImagePreviewClient>
        </Box>
      ) : null}
      <Box
        mb={{
          mobile: 40,
          smallDesktop: 32,
          desktop: 32,
        }}
      >
        <Text size="3" color="gray">
          {date}
        </Text>
      </Box>

      <Box
        display="flex"
        flexDirection={{
          smallDesktop: 'column',
        }}
        gap={{
          mobile: 48,
          smallDesktop: 40,
          desktop: 40,
        }}
      >
        <ImagePreviewClient>
          <GutenbergProvider as="section">{parsed.body}</GutenbergProvider>
        </ImagePreviewClient>
        <Box as="aside" position="relative" className={css.aside}>
          <Box display="flex" flexDirection="column" position="sticky" top={32} gap={20}>
            <SimilarNews category={category} region={region} currentId={Number(id)} />
            <NewsletterSignup variant="narrow" title="Подписаться" />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
