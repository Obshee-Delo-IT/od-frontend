import { fetchSearch, type SearchSubtype } from '@/shared/api';
import { canonicalUrl, ogCard } from '@/shared/config/site';
import { Box } from '@/shared/ui/components/Box';
import { Link } from '@/shared/ui/components/Link';
import { PageHeader } from '@/shared/ui/components/PageHeader';
import { Pagination } from '@/shared/ui/components/Pagination';
import css from './page.module.css';
import type { Metadata } from 'next';

const TITLE = 'Поиск по сайту';
const DESCRIPTION = 'Поиск по новостям, фильмам, материалам и страницам сайта «Общее дело».';
const PER_PAGE = 20;

/** What a hit is, in words, for the line under its title. */
const KIND: Partial<Record<SearchSubtype, string>> = {
  post: 'Новость',
  page: 'Страница',
  profile: 'Человек',
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[]; s?: string | string[]; page?: string | string[] }>;
}

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * `q` is this site's parameter and `s` is WordPress's, accepted because the
 * legacy `?s=` URLs are still in search results and in people's bookmarks —
 * `resolveLegacyUrl` sends `/?s=<term>` here, and dropping the term on the way
 * would answer with an empty search box.
 */
const resolveParams = ({ q, s, page }: Awaited<SearchPageProps['searchParams']>) => {
  const pageParam = Number(firstParam(page));
  return {
    query: (firstParam(q) ?? firstParam(s) ?? '').trim(),
    currentPage: Number.isFinite(pageParam) && pageParam > 1 ? Math.floor(pageParam) : 1,
  };
};

const buildHref = ({ query, page }: { query: string; page: number }): string => {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const qs = params.toString();
  return qs ? `/search/?${qs}` : '/search/';
};

/**
 * `noindex` on every variant, and it is not a detail: a search page indexes
 * infinitely many query strings, each a thin near-duplicate of a listing that
 * already has a canonical address. Yandex and Google both treat that as a
 * crawl-budget hole. The results themselves are all pages this site already
 * publishes.
 */
export const generateMetadata = async ({ searchParams }: SearchPageProps): Promise<Metadata> => {
  const { query } = resolveParams(await searchParams);
  const title = query ? `Поиск: ${query} — ОБЩЕЕ ДЕЛО` : `${TITLE} — ОБЩЕЕ ДЕЛО`;
  const description = query ? `Результаты поиска по сайту «Общее дело»: ${query}.` : DESCRIPTION;

  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: canonicalUrl('/search/') },
    /* Declaring none kept the root layout's card, so a shared search link
       unfurled as the home page. `noindex` says nothing about what a chat client
       renders when someone pastes the URL.

       `og:url` carries the query while the canonical does not, and the two
       disagree on purpose: the canonical collapses every query onto one
       indexable address, while a network caches the card *against* `og:url`, so
       the bare form there would make every shared search unfurl as whichever
       query was scraped first. */
    openGraph: ogCard({ type: 'website', url: canonicalUrl(buildHref({ query, page: 1 })), title, description }),
  };
};

/**
 * `/search/` — the results page behind the header's search field (B7).
 *
 * **Why it exists now.** The field and the magnifier have shipped in the header
 * since C9 with nothing behind them: «кнопка поиска на сайте не активна»
 * (Р. Низамов, 2026-08-27). A button that does nothing is worse than no button,
 * and `fetchSearch` has been sitting unconsumed since B7.
 *
 * **A native GET form, no client component.** The header submits
 * `/search/?q=<term>`, this page reads it and renders on the server; the form
 * below is the same thing, so the page works with JavaScript off and there is
 * no state to keep in sync with the URL.
 *
 * **What a result looks like is settled by what WP returns**: `GET /wp/v2/search`
 * hands back id, title, url and subtype — no excerpt, no thumbnail — so a hit is
 * its title plus what kind of thing it is. Fetching each hit's post to draw a
 * card would be 20 extra requests per query for a preview line; the mock this
 * page never had can add it when there is one.
 */
const Page = async ({ searchParams }: SearchPageProps) => {
  const { query, currentPage } = resolveParams(await searchParams);
  const { items, totalPages, total } = await fetchSearch({ query, page: currentPage, perPage: PER_PAGE });

  const breadcrumbItems = [{ label: 'Главная', href: '/' }, { label: TITLE }];

  return (
    <Box display="flex" flexDirection="column" gap={32} pt={20} pb={48}>
      <PageHeader title={TITLE} breadcrumbs={breadcrumbItems} />

      <form className={css.form} action="/search/" method="get" role="search">
        <input
          className={css.field}
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Что ищем?"
          aria-label={TITLE}
        />
        <button className={css.submit} type="submit">
          Найти
        </button>
      </form>

      {query === '' && <p className={css.note}>Введите слово или фразу — поиск идёт по новостям, страницам и людям.</p>}

      {query !== '' && (
        <p className={css.note}>{total > 0 ? `Найдено: ${total}` : `По запросу «${query}» ничего не найдено.`}</p>
      )}

      {items.length > 0 && (
        <ul className={css.results}>
          {items.map((hit) => (
            <li key={`${hit.subtype ?? 'hit'}-${hit.id}`} className={css.result}>
              <Link href={hit.href} color="primary" className={css.title}>
                {hit.title}
              </Link>
              {hit.subtype && KIND[hit.subtype] && <span className={css.kind}>{KIND[hit.subtype]}</span>}
            </li>
          ))}
        </ul>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} buildHref={(page) => buildHref({ query, page })} />
    </Box>
  );
};

export default Page;
