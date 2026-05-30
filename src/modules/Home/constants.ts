import type { HeroBannerAction } from './HeroBanner';

export const HERO_BANNER = {
  title: 'Вместе делаем общее дело',
  subtitle: 'Социальные проекты для здоровья и развития молодёжи России.',
  actions: [
    { label: 'Стать волонтером', href: '/volunteer' },
    { label: 'Оказать помощь', href: '/donate', variant: 'soft' },
  ] satisfies HeroBannerAction[],
};

export const PROMO_BANNER = {
  title: 'Прими участие в международном конкурсе социальных проектов',
  ctaHref: '/contest',
};

export const STATS = [
  { value: 12, label: 'лет работы' },
  { value: 2500, label: 'волонтеров' },
  { value: 50, label: 'регионов' },
  { value: 25, label: 'фильмов' },
];

export const DIRECTIONS = [
  { title: 'Бизнес клуб', href: '/business-club' },
  { title: 'Общее дело ПРО', href: '/od-pro' },
  { title: 'ОД ИТ', href: '/od-it' },
];

export const PROGRAMS = [
  { title: 'Здоровая Россия', href: '/programs/healthy-russia' },
  { title: 'Здоровые дети', href: '/programs/healthy-children' },
  { title: 'Здоровая молодежь', href: '/programs/healthy-youth' },
];
