import { Link } from '@/shared/ui/components/Link';
import css from './LinkCard.module.css';

export interface LinkCardProps {
  title: string;
  href: string;
  illustration?: React.ReactNode;
  linkLabel?: string;
}

export const LinkCard = ({ title, href, illustration, linkLabel = 'Подробнее' }: LinkCardProps) => (
  <article className={css.root}>
    <div className={css.illustration}>{illustration}</div>
    <h3 className={css.title}>{title}</h3>
    <span className={css.spacer} />
    <Link href={href} underline="hover">
      {linkLabel}
    </Link>
  </article>
);
