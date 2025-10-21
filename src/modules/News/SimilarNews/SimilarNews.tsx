import dayjs from 'dayjs';
import { fetchSimilarNews } from '@/shared/api/fetchSimilarNews';
import css from './SimilarNews.module.css';

interface SimilarNewsProps {
  category: number;
  region: number;
}

export const SimilarNews = async ({ category, region }: SimilarNewsProps) => {
  const { data } = await fetchSimilarNews({ category: category, region: region });

  return (
    <>
      <div className={css.container}>
        <div className={css.header}>
          <p className={css.title}>Похожие новости</p>
          <p className={css.link}>Все статьи</p>
        </div>

        {data?.map((el) => {
          const date = dayjs(el.date).format('DD.MM.YYYY');

          return (
            <div className={css.news} key={el.id}>
              <div className={css.newsItem}>
                <p className={css.date}>{date}</p>
                <a href={el.link} className={css.newsName}>
                  {el.title.rendered}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
