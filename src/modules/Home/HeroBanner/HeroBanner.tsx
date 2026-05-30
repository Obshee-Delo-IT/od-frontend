import { Button } from '@radix-ui/themes';
import NextLink from 'next/link';
import css from './HeroBanner.module.css';

export interface HeroBannerAction {
  label: string;
  href: string;
  variant?: 'solid' | 'soft' | 'outline';
}

export interface HeroBannerProps {
  title: string;
  subtitle?: string;
  actions?: HeroBannerAction[];
}

export const HeroBanner = ({ title, subtitle, actions = [] }: HeroBannerProps) => (
  <section className={css.root}>
    <div className={css.body}>
      <h1 className={css.title}>{title}</h1>
      {subtitle ? <p className={css.subtitle}>{subtitle}</p> : null}
      {actions.length > 0 ? (
        <div className={css.actions}>
          {actions.map((action) => (
            <Button key={action.href} asChild size="4" variant={action.variant ?? 'solid'}>
              <NextLink href={action.href}>{action.label}</NextLink>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  </section>
);
