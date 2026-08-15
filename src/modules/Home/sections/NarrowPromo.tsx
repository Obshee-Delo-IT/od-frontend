import { Button } from '@/shared/ui/components/Button';
import css from './NarrowPromo.module.css';

// The contest season rolls over on 1 August: until then the banner still advertises the season
// that opened last October, so August 2026 shows 2026/2027 while July 2026 shows 2025/2026.
export const promoDate = (now: Date): string => {
  const start = now.getFullYear() - (now.getMonth() >= 7 ? 0 : 1);
  return `1 октября ${start} – 28 апреля ${start + 1}`;
};

export const NarrowPromo: React.FC = () => {
  const date = promoDate(new Date());

  return (
    <section className={css.banner} aria-labelledby="promo-heading">
      <div className={css.mobileDecoration}>
        <span className={css.dateMobile}>{date}</span>
      </div>
      <div className={css.content}>
        <h2 id="promo-heading" className={css.title}>
          Прими участие в
          <br />
          международном
          <br />
          конкурсе социальных
          <br />
          проектов
        </h2>
        <Button variant="white" size="large" asChild>
          <a href="https://od-pro.ru/" target="_blank" rel="noopener noreferrer">
            Подробнее
          </a>
        </Button>
      </div>
      <span className={css.dateDesktop}>{date}</span>
    </section>
  );
};
