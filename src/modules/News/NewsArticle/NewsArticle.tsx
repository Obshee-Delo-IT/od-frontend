import { Text, VisuallyHidden } from '@radix-ui/themes';
import { NewsletterSignup } from '@/modules/NewsletterSignup';
import { extractFirstImage } from '@/shared/api/extractFirstImage';
import { cachedFetchFeaturedImage } from '@/shared/api/fetchFeaturedImage';
import { cachedFetchNews } from '@/shared/api/fetchNews';
import { wpBaseUrl } from '@/shared/api/httpClient';
import { resolveMediaUrl } from '@/shared/api/mediaUrl';
import { buildNewsPreview, stripHtml } from '@/shared/api/newsPreview';
import { jsonLdHtml, newsJsonLd } from '@/shared/config/jsonLd';
import { canonicalUrl, ogCard, ogCardImage } from '@/shared/config/site';
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

/* The editor's own lead image, with the body's first image only as a fallback.
   The newest 100 posts all carry `featured_media` (against 1 of 100 pages);
   uniformly over all 8 286, 49 of 76 do — the 2013-2016 archive is what the rest
   is. So this is a picture someone chose for the post, where the body's first
   image is whatever the layout happens to open with.

   Both go through the resolution pipeline rather than the raw URL: the WordPress
   origin **301s** an offloaded upload to the Yandex bucket, and a social crawler
   that doesn't follow the hop shows no image at all.

   Stated once because the card and the JSON-LD must name the same picture, and
   free to call twice: the fetch is React-`cache()`d and `resolveMediaUrl`'s HEAD
   probe is memoised, so the second caller in a render pass adds no request. */
const leadImage = async (post: Awaited<ReturnType<typeof cachedFetchNews>>, id: string) => {
  const featured = await cachedFetchFeaturedImage(post?.featured_media, id);
  const url = featured?.url ?? (await resolveMediaUrl(extractFirstImage(post?.content?.rendered, wpBaseUrl)));

  return { featured, url };
};

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
  // back to the body for the many posts that have no manual excerpt — and with
  // the headline dropped when the body opens by repeating it.
  const description = buildNewsPreview(post?.excerpt?.rendered, post?.content?.rendered, title) ?? undefined;
  const url = canonicalUrl(`/${id}/`);
  const { featured, url: image } = await leadImage(post, id);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: ogCard({
      type: 'article',
      url,
      title,
      description,
      // WP omits the zone designator on its GMT timestamps.
      publishedTime: post?.date_gmt ? `${post.date_gmt}Z` : undefined,
      modifiedTime: post?.modified_gmt ? `${post.modified_gmt}Z` : undefined,
      /* The attachment's own `media_details` carries the pixels, so the card
         can state them — and 14 % of posts turn out to have a 160×120 or
         150×200 thumbnail as their lead image, which renders as *no* card in
         Facebook and WhatsApp. `ogCardImage` sends those to the branded card
         instead. The body-image fallback has no cheap size source, so it ships
         without the two tags, exactly as everything did before. */
      images: [ogCardImage(image, featured)],
    }),
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

  /* The same fields the card already states, said again in schema.org's words —
     no extra request: every fetch behind them is `cache()`d and shared with
     `newsMetadata` in this render pass. WP omits the zone designator on its GMT
     timestamps, so `Z` is appended here exactly as the card does it. */
  const schema = newsJsonLd({
    id,
    headline: title,
    description: buildNewsPreview(data?.excerpt?.rendered, data?.content?.rendered, title || undefined),
    image: (await leadImage(data, id)).url,
    datePublished: data?.date_gmt ? `${data.date_gmt}Z` : null,
    dateModified: data?.modified_gmt ? `${data.modified_gmt}Z` : null,
  });

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
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(schema) }} />}
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
