import { Heading } from '@radix-ui/themes';
import { Button } from '@/shared/ui/components/Button';
import { NewsCard } from '@/shared/ui/components/NewsCard';
import css from './NewsGrid.module.css';

export interface NewsItem {
  id: string | number;
  title: string;
  date?: string;
  href: string;
  imageSrc?: string | null;
  imageAlt?: string;
}

export interface NewsGridProps {
  items: NewsItem[];
}

export const NewsGrid: React.FC<NewsGridProps> = ({ items }) => (
  <section className={css.section} aria-labelledby="news-heading">
    <Heading as="h2" id="news-heading" size="9" className={css.heading}>
      Наши дела
    </Heading>

    <div className={css.grid}>
      {items.map((item) => (
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

    <div className={css.cta}>
      <Button variant="outline" size="large">
        Посмотреть все
      </Button>
    </div>
  </section>
);
