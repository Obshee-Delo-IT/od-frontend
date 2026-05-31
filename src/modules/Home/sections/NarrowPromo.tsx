import { Button } from '@/shared/ui/components/Button';
import css from './NarrowPromo.module.css';

export const NarrowPromo: React.FC = () => (
  <section className={css.banner} aria-labelledby="promo-heading">
    <div className={css.mobileDecoration} aria-hidden="true" />
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
  </section>
);
