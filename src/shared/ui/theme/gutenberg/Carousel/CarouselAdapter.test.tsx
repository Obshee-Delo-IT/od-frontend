import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GutenbergCarouselAdapter } from './CarouselAdapter';

/**
 * The adapter's job is bookkeeping around a Swiper it cannot see into, so the
 * real one is replaced by the two things this file is about: the `el.swiper`
 * stamp a mounted carousel leaves behind, and `destroy()`.
 */
const { instances } = vi.hoisted(() => ({
  instances: [] as Array<{ el: HTMLElement; destroyed: boolean; destroy: () => void }>,
}));

vi.mock('swiper/modules', () => ({ Navigation: {}, Pagination: {}, Autoplay: {}, A11y: {} }));
vi.mock('swiper', () => ({
  default: class FakeSwiper {
    destroyed = false;

    constructor(readonly el: HTMLElement) {
      Object.assign(el, { swiper: this });
      instances.push(this);
    }

    destroy() {
      this.destroyed = true;
      Reflect.deleteProperty(this.el, 'swiper');
    }
  },
}));

const carousel = (className: string) =>
  `<div class="wp-block-cb-carousel-v2 cb-carousel-block ${className}" data-cb-navigation="true">` +
  '<div class="swiper"><div class="swiper-wrapper"><div class="swiper-slide"></div></div></div>' +
  '</div>';

beforeEach(() => {
  document.body.innerHTML = `${carousel('od-cards')}${carousel('od-poster-cards')}<div class="swiper"></div>`;
});

afterEach(() => {
  instances.length = 0;
  document.body.innerHTML = '';
});

describe('GutenbergCarouselAdapter', () => {
  it('mounts one Swiper per carousel block and ignores a `.swiper` outside one', () => {
    render(<GutenbergCarouselAdapter />);

    expect(instances).toHaveLength(2);
    expect(instances.every(({ el }) => el.closest('.cb-carousel-block') !== null)).toBe(true);
  });

  /* A news article renders two `GutenbergProvider`s — one for the lifted header,
     one for the body — and each brings an adapter that scans the whole document. */
  it('leaves a carousel another adapter already mounted alone', () => {
    render(<GutenbergCarouselAdapter />);
    render(<GutenbergCarouselAdapter />);

    expect(instances).toHaveLength(2);
  });

  it('destroys what it mounted when it unmounts', () => {
    const { unmount } = render(<GutenbergCarouselAdapter />);
    unmount();

    expect(instances.map(({ destroyed }) => destroyed)).toEqual([true, true]);
  });
});
