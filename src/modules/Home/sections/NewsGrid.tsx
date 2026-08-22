import { Heading } from '@radix-ui/themes';
import Image from 'next/image';
import NextLink from 'next/link';
import { Button } from '@/shared/ui/components/Button';
import { NewsCard } from '@/shared/ui/components/NewsCard';
import css from './NewsGrid.module.css';

interface NewsItem {
  id: string | number;
  title: string;
  date?: string;
  href: string;
  imageSrc?: string | null;
  imageAlt?: string;
  excerpt?: string;
}

export interface NewsGridProps {
  items: NewsItem[];
}

const FeaturedNewsCard: React.FC<NewsItem> = ({ title, date, href, imageSrc, imageAlt = '', excerpt }) => (
  <NextLink href={href} className={css.featured}>
    <div className={css.featuredMedia}>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 900px) 100vw, 600px"
          className={css.featuredImage}
        />
      ) : null}
    </div>
    <div className={css.featuredBody}>
      {date ? <span className={css.featuredDate}>{date}</span> : null}
      <Heading as="h3" size="5" weight="bold" className={css.featuredTitle}>
        {title}
      </Heading>
      {excerpt ? <p className={css.featuredExcerpt}>{excerpt}</p> : null}
    </div>
  </NextLink>
);

export const NewsGrid: React.FC<NewsGridProps> = ({ items }) => {
  const [featured, ...rest] = items;

  return (
    <section className={css.section} aria-labelledby="news-heading">
      <Heading as="h2" id="news-heading" size="9" className={css.heading}>
        Наши дела
      </Heading>

      {featured ? <FeaturedNewsCard {...featured} /> : null}

      {rest.length > 0 ? (
        <div className={css.grid}>
          {rest.map((item) => (
            <NewsCard
              key={item.id}
              href={item.href}
              title={item.title}
              date={item.date}
              imageSrc={item.imageSrc}
              imageAlt={item.imageAlt}
            />
          ))}
        </div>
      ) : null}

      <div className={css.cta}>
        <Button variant="outline" size="large" asChild>
          <NextLink href="/news">Все новости</NextLink>
        </Button>
      </div>
    </section>
  );
};
