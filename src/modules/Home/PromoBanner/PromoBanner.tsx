import { Button } from '@radix-ui/themes';
import NextLink from 'next/link';
import css from './PromoBanner.module.css';

export interface PromoBannerProps {
  title: string;
  ctaLabel?: string;
  ctaHref: string;
}

export const PromoBanner = ({ title, ctaLabel = 'Подробнее', ctaHref }: PromoBannerProps) => (
  <aside className={css.root}>
    <h3 className={css.title}>{title}</h3>
    <Button asChild size="3">
      <NextLink href={ctaHref}>{ctaLabel}</NextLink>
    </Button>
  </aside>
);
