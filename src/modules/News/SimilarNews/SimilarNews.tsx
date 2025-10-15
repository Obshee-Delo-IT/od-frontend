// import { fetchSimilarNews } from '@/shared/api/fetchSimilarNews';
import css from './SimilarNews.module.css';

// interface SimilarNewsProps {
//   category: number;
//   region: number;
// }

export const SimilarNews = async () => (
  // { category, region }: SimilarNewsProps

  // const similar = await fetchSimilarNews({ category: category, region: region });

  <>
    <div className={css.container}>
      <div className={css.header}>
        <p className={css.title}>Похожие новости</p>
        <p className={css.link}>Все статьи</p>
      </div>

      <div className={css.news}>
        <div className={css.newsItem}>
          <p className={css.date}>01.01.2023</p>
          <p className={css.newsName}>На страже здоровья детства и учителей</p>
        </div>
        <div className={css.newsItem}>
          <p className={css.date}>01.01.2023</p>
          <p className={css.newsName}>На страже здоровья детства и учителей</p>
        </div>
        <div className={css.newsItem}>
          <p className={css.date}>01.01.2023</p>
          <p className={css.newsName}>На страже здоровья детства и учителей</p>
        </div>
        <div className={css.newsItem}>
          <p className={css.date}>01.01.2023</p>
          <p className={css.newsName}>На страже здоровья детства и учителей</p>
        </div>
      </div>
    </div>
  </>
);
