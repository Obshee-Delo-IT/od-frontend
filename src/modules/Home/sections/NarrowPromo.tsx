import { Button } from '@/shared/ui/components/Button';
import css from './NarrowPromo.module.css';

const PROMO_DATE = '1 октября 2022 – 28 апреля 2023';

export const NarrowPromo: React.FC = () => (
  <section className={css.banner} aria-labelledby="promo-heading">
    <div className={css.mobileDecoration}>
      <span className={css.dateMobile}>{PROMO_DATE}</span>
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
      <Button variant="white" size="large">
        Подробнее
      </Button>
    </div>
    <span className={css.dateDesktop}>{PROMO_DATE}</span>
  </section>
);
