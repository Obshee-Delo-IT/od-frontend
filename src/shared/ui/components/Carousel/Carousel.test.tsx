import { Theme } from '@radix-ui/themes';
import { act, render, screen } from '@testing-library/react';
import { createElement, useEffect, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

interface FakeSwiper {
  isBeginning: boolean;
  isEnd: boolean;
  isLocked: boolean;
  slideNext: Mock;
  slidePrev: Mock;
  params: { pagination: false | { el?: string; bulletClass?: string } };
}

interface PaginationOpts {
  el?: string;
  bulletClass?: string;
  bulletActiveClass?: string;
  clickable?: boolean;
}

type SwiperHandler = (swiper: FakeSwiper) => void;

interface SwiperMockProps {
  children?: ReactNode;
  pagination?: false | PaginationOpts;
  onSwiper?: SwiperHandler;
  onSlideChange?: SwiperHandler;
  onResize?: SwiperHandler;
  onBreakpoint?: SwiperHandler;
  onLock?: SwiperHandler;
  onUnlock?: SwiperHandler;
  [key: string]: unknown;
}

// jsdom has no layout, so a real Swiper can't compute slide widths / edges.
// Mock swiper/react with a controllable fake so we can drive isBeginning /
// isEnd / isLocked and assert how the Carousel chrome reacts.
const h = vi.hoisted(() => ({
  handlers: {} as Record<string, SwiperHandler | undefined>,
  fake: null as FakeSwiper | null,
}));

vi.mock('swiper/modules', () => ({ Navigation: {}, Pagination: {}, A11y: {} }));

vi.mock('swiper/react', () => ({
  Swiper: ({
    children,
    onSwiper,
    onSlideChange,
    onResize,
    onBreakpoint,
    onLock,
    onUnlock,
    pagination,
  }: SwiperMockProps) => {
    h.handlers = { onSlideChange, onResize, onBreakpoint, onLock, onUnlock };
    useEffect(() => {
      const fake: FakeSwiper = {
        isBeginning: true,
        isEnd: false,
        isLocked: false,
        slideNext: vi.fn(),
        slidePrev: vi.fn(),
        params: { pagination: typeof pagination === 'object' ? { ...pagination } : false },
      };
      h.fake = fake;
      onSwiper?.(fake);

      // simulate Swiper's Pagination module: find the external el by selector
      // and render one bullet per page
      if (typeof pagination === 'object' && pagination.el) {
        const el = document.querySelector(pagination.el);
        if (el) {
          el.innerHTML = '';
          for (let i = 0; i < 4; i += 1) {
            const bullet = document.createElement('span');
            bullet.className = pagination.bulletClass ?? 'bullet';
            el.appendChild(bullet);
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return createElement('div', { 'data-testid': 'swiper' }, children);
  },
  SwiperSlide: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}));

import { Carousel } from './Carousel';

const ITEMS = Array.from({ length: 6 }, (_, i) => <span key={i}>Слайд {i + 1}</span>);

const renderCarousel = (props: Partial<React.ComponentProps<typeof Carousel>> = {}) =>
  render(
    <Theme accentColor="red">
      <Carousel ariaLabel="Тестовая карусель" items={ITEMS} {...props} />
    </Theme>
  );

const prevButton = () => screen.getByRole('button', { name: 'Предыдущий слайд' });
const nextButton = () => screen.getByRole('button', { name: 'Следующий слайд' });
const controls = () =>
  document.querySelector('[data-testid="swiper"]')?.parentElement?.querySelector('[class*="controls"]') as HTMLElement;

// drive a state change through the swiper event handlers
const sync = (patch: Partial<FakeSwiper>) =>
  act(() => {
    if (h.fake) {
      Object.assign(h.fake, patch);
      h.handlers.onSlideChange?.(h.fake);
    }
  });

beforeEach(() => {
  h.handlers = {};
  h.fake = null;
});

describe('<Carousel />', () => {
  it('renders every item as a slide', () => {
    renderCarousel();
    ITEMS.forEach((_, i) => {
      expect(screen.getByText(`Слайд ${i + 1}`)).toBeInTheDocument();
    });
  });

  it('renders prev/next buttons and the dot pagination between them', () => {
    renderCarousel();
    const children = Array.from(controls().children);

    // order: prev button, pagination, next button
    expect(children).toHaveLength(3);
    expect(children[0]).toHaveAttribute('aria-label', 'Предыдущий слайд');
    expect(children[2]).toHaveAttribute('aria-label', 'Следующий слайд');

    const pagination = children[1] as HTMLElement;
    expect(pagination.children).toHaveLength(4); // dots rendered into the external el
  });

  it('disables prev at the first page and next at the last page', () => {
    renderCarousel();
    // initial state: at the beginning
    expect(prevButton()).toBeDisabled();
    expect(nextButton()).toBeEnabled();

    // advance past the first slide
    sync({ isBeginning: false, isEnd: false });
    expect(prevButton()).toBeEnabled();
    expect(nextButton()).toBeEnabled();

    // reach the end
    sync({ isBeginning: false, isEnd: true });
    expect(prevButton()).toBeEnabled();
    expect(nextButton()).toBeDisabled();
  });

  it('drives the swiper when the arrows are clicked', () => {
    renderCarousel();
    sync({ isBeginning: false, isEnd: false }); // make both arrows active

    nextButton().click();
    expect(h.fake?.slideNext).toHaveBeenCalled();

    prevButton().click();
    expect(h.fake?.slidePrev).toHaveBeenCalled();
  });

  it('marks the controls locked when all slides fit (no overflow)', () => {
    renderCarousel();
    expect(controls()).not.toHaveAttribute('data-locked');

    sync({ isLocked: true });
    expect(controls()).toHaveAttribute('data-locked', 'true');
  });
});
