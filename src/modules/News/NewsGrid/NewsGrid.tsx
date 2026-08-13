import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { NewsCard } from '@/shared/ui/components/NewsCard';
import css from './NewsGrid.module.css';
import type { NewsSummary } from '@/shared/api';

dayjs.locale('ru');

export interface NewsGridProps {
  items: NewsSummary[];
  /** Shown in place of the grid when the fetch came back empty. */
  emptyMessage?: string;
}

/**
 * The three-column post grid, shared by `/news/` and the `/materials/articles/`
 * alias so the two list pages can't drift apart in card shape or date format.
 *
 * Every card links to `/<id>/` — the only address a post has (see A8).
 */
export const NewsGrid: React.FC<NewsGridProps> = ({ items, emptyMessage = 'Новостей не найдено.' }) => {
  if (items.length === 0) {
    return <p className={css.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={css.grid}>
      {items.map((post) => (
        <NewsCard
          key={post.id}
          href={`/${post.id}`}
          title={post.title}
          date={post.date ? dayjs(post.date).format('DD.MM.YYYY') : undefined}
          imageSrc={post.thumbnailUrl}
          imageAlt={post.title}
        />
      ))}
    </div>
  );
};
