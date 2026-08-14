import parse from 'html-react-parser';
import { fetchSimilarNews } from '@/shared/api/fetchSimilarNews';
import { formatDate } from '@/shared/lib/formatDate';
import { Link } from '@/shared/ui/components/Link';
import css from './SimilarNews.module.css';

interface SimilarNewsProps {
  category: number;
  region: number;
}

export const SimilarNews = async ({ category, region }: SimilarNewsProps) => {
  const { data } = await fetchSimilarNews({ category: category, region: region });

  return (
    <div className={css.container}>
      <div className={css.header}>
        <h3 className={css.title}>Похожие новости</h3>
        <p className={css.link}>Все статьи</p>
      </div>

      {data?.map((el) => {
        const date = formatDate(el.date);
        if (el.link && el.title?.rendered) {
          return (
            <div className={css.news} key={el.id}>
              <div className={css.newsItem}>
                <p className={css.date}>{date}</p>
                <Link href={el.link} size="4" color="primary" weight="bold">
                  {parse(el.title?.rendered)}
                </Link>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
};
