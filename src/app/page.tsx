import dayjs from 'dayjs';
import parse from 'html-react-parser';
import { Metadata } from 'next';
import NextLink from 'next/link';
import { DIRECTIONS, HERO_BANNER, PROGRAMS, PROMO_BANNER, STATS } from '@/modules/Home/constants';
import { HeroBanner } from '@/modules/Home/HeroBanner';
import { PromoBanner } from '@/modules/Home/PromoBanner';
import { FeaturedNewsCard } from '@/modules/News/FeaturedNewsCard';
import { NewsCard } from '@/modules/News/NewsCard';
import { SubscribeForm } from '@/modules/Subscribe';
import { cachedFetchFilms } from '@/shared/api/fetchFilms';
import { cachedFetchLatestNews } from '@/shared/api/fetchLatestNews';
import { Carousel } from '@/shared/ui/components/Carousel';
import { LinkCard } from '@/shared/ui/components/LinkCard';
import { StatItem } from '@/shared/ui/components/StatItem';
import css from './page.module.css';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'ОБЩЕЕ ДЕЛО',
  description: 'Общероссийская общественная организация',
};

const Page = async () => {
  const [films, latestNews] = await Promise.all([
    cachedFetchFilms({ perPage: 6 }),
    cachedFetchLatestNews({ perPage: 5 }),
  ]);

  const [featuredNews, ...restNews] = latestNews;

  return (
    <div className={css.page}>
      <HeroBanner title={HERO_BANNER.title} subtitle={HERO_BANNER.subtitle} actions={HERO_BANNER.actions} />

      <section>
        <ul className={css.statsRow} aria-label="Ключевые показатели">
          {STATS.map((stat) => (
            <li key={stat.label}>
              <StatItem value={stat.value} label={stat.label} />
            </li>
          ))}
        </ul>
      </section>

      {films.length > 0 ? (
        <section aria-labelledby="films-heading">
          <h2 id="films-heading" className={css.sectionTitle}>
            Фильмы
          </h2>
          <Carousel ariaLabel="Фильмы" slidesPerView={3}>
            {films.map((film) => (
              <article key={film.id} className={css.film}>
                <div className={css.filmCover} />
                <NextLink href={`/news/${film.id}`} className={css.filmTitle}>
                  {parse(film.title?.rendered ?? '')}
                </NextLink>
              </article>
            ))}
          </Carousel>
        </section>
      ) : null}

      <PromoBanner title={PROMO_BANNER.title} ctaHref={PROMO_BANNER.ctaHref} />

      <section aria-labelledby="directions-heading">
        <h2 id="directions-heading" className={css.sectionTitle}>
          Направления деятельности
        </h2>
        <div className={css.cardGrid}>
          {DIRECTIONS.map((item) => (
            <LinkCard key={item.href} title={item.title} href={item.href} />
          ))}
        </div>
      </section>

      <section aria-labelledby="programs-heading">
        <h2 id="programs-heading" className={css.sectionTitle}>
          Программы
        </h2>
        <div className={css.cardGrid}>
          {PROGRAMS.map((item) => (
            <LinkCard key={item.href} title={item.title} href={item.href} />
          ))}
        </div>
      </section>

      {featuredNews ? (
        <section aria-labelledby="news-heading">
          <h2 id="news-heading" className={css.sectionTitle}>
            Наши дела
          </h2>

          <FeaturedNewsCard
            id={featuredNews.id ?? 0}
            date={featuredNews.date ?? dayjs().toISOString()}
            title={featuredNews.title?.rendered ?? ''}
            excerpt={featuredNews.excerpt?.rendered}
          />

          {restNews.length > 0 ? (
            <div className={css.newsGrid} style={{ marginTop: 32 }}>
              {restNews.map((post) => (
                <NewsCard
                  key={post.id}
                  id={post.id ?? 0}
                  date={post.date ?? dayjs().toISOString()}
                  title={post.title?.rendered ?? ''}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section>
          <h2 className={css.sectionTitle}>Наши дела</h2>
          <p className={css.emptyState}>Новости появятся скоро.</p>
        </section>
      )}

      <section>
        <SubscribeForm />
      </section>
    </div>
  );
};

export default Page;
