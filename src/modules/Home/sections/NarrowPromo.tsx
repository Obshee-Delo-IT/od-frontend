import { Button } from '@/shared/ui/components/Button';
import css from './NarrowPromo.module.css';

export const NarrowPromo: React.FC = () => (
  <section className={css.banner} aria-labelledby="promo-heading">
    <div className={css.content}>
      <h2 id="promo-heading" className={css.title}>
        Прими участие в международном
        <br />
        конкурсе социальных проектов
      </h2>
      <Button variant="white" size="large">
        Подробнее
      </Button>
    </div>
  </section>
);
