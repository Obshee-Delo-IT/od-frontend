import css from './SimilarNews.module.css';

export const SimilarNews = async () => (
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
);
