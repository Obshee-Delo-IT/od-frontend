import { fetchSimilarNews } from '@/shared/api/fetchSimilarNews';
import { stripHtml } from '@/shared/api/newsPreview';
import { formatDate } from '@/shared/lib/formatDate';
import { Link } from '@/shared/ui/components/Link';
import css from './SimilarNews.module.css';

interface SimilarNewsProps {
  category: number;
  region: number;
  /** The article this rail sits beside — excluded from its own «похожие». */
  currentId?: number;
}

export const SimilarNews = async ({ category, region, currentId }: SimilarNewsProps) => {
  const { data } = await fetchSimilarNews({ category, region, exclude: currentId });

  return (
    <div className={css.container}>
      <div className={css.header}>
        <h3 className={css.title}>Похожие новости</h3>
        <p className={css.link}>Все статьи</p>
      </div>

      {data?.map((el) => {
        const date = formatDate(el.date);
        if (el.id && el.title?.rendered) {
          return (
            <div className={css.news} key={el.id}>
              <div className={css.newsItem}>
                <p className={css.date}>{date}</p>
                {/* `/<id>/`, not WP's own `link`: passing the REST permalink
                    through sent every visitor off this site onto the WordPress
                    host, which is where all ten rail links pointed (JRN-07). */}
                <Link href={`/${el.id}/`} size="4" color="primary" weight="bold">
                  {stripHtml(el.title.rendered)}
                </Link>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};
