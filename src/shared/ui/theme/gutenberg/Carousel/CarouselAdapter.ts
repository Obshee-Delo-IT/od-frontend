'use client';

import { useEffect } from 'react';
import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import type { SwiperOptions } from 'swiper/types';

/**
 * Only the attributes {@link createSwiperConfig} reads. The block also carries
 * `data-cb-space-between` and `data-cb-breakpoints`, both of which this adapter
 * overrides with its own values — parsing them (the breakpoints through
 * `JSON.parse`, on markup from WordPress) bought nothing.
 */
interface CarouselBlockAttributes {
  slidesPerView: number;
  slidesPerGroup: number;
  speed: number;
  hasNavigation: boolean;
  hasPagination: boolean;
  loop: boolean;
  autoplay: false | { delay: number; disableOnInteraction: boolean };
}

const parseCarouselAttributes = (carouselBlock: Element): CarouselBlockAttributes => {
  const getIntAttribute = (name: string, defaultValue: string): number =>
    parseInt(carouselBlock.getAttribute(name) || defaultValue, 10);

  const getBooleanAttribute = (name: string): boolean => carouselBlock.getAttribute(name) === 'true';

  const hasAutoplay = getBooleanAttribute('data-cb-autoplay');

  return {
    slidesPerView: getIntAttribute('data-cb-slides-per-view', '1'),
    slidesPerGroup: getIntAttribute('data-cb-slides-per-group', '1'),
    speed: getIntAttribute('data-cb-speed', '300'),
    hasNavigation: getBooleanAttribute('data-cb-navigation'),
    hasPagination: getBooleanAttribute('data-cb-pagination'),
    loop: getBooleanAttribute('data-cb-loop'),
    autoplay: hasAutoplay
      ? {
          delay: getIntAttribute('data-cb-autoplay-speed', '3000'),
          disableOnInteraction: false,
        }
      : false,
  };
};

/**
 * A carousel whose slides come from a `core/query` instead of `cb/slide-v2`:
 * WordPress renders the list as `<ul class="wp-block-post-template">` with
 * `<li class="wp-block-post">` children, so Swiper has to be told those are the
 * track and its slides. `od_pages_film_query()` in `wp/scripts/od-pages.php`
 * gives the template the `swiper-wrapper` class, which is why only the slide
 * needs naming here.
 */
const QUERY_SLIDE_CLASS = 'wp-block-post';

const createSwiperConfig = (carouselBlock: Element, attributes: CarouselBlockAttributes): SwiperOptions => ({
  modules: [Navigation, Pagination, Autoplay],
  slidesPerView: 'auto',
  slidesPerGroup: 1,
  spaceBetween: 40,
  speed: attributes.speed,
  loop: attributes.loop,
  loopAddBlankSlides: true,
  autoplay: attributes.autoplay,
  navigation: attributes.hasNavigation
    ? {
        nextEl: carouselBlock.querySelector<HTMLElement>('.cb-button-next'),
        prevEl: carouselBlock.querySelector<HTMLElement>('.cb-button-prev'),
      }
    : false,
  pagination: attributes.hasPagination
    ? {
        el: carouselBlock.querySelector<HTMLElement>('.cb-pagination'),
        clickable: true,
        bulletClass: 'cb-pagination-bullet',
      }
    : false,
  breakpoints: {
    900: {
      slidesPerView: attributes.slidesPerView || 3,
      slidesPerGroup: attributes.slidesPerGroup || 1,
    },
  },
  resizeObserver: true,
  breakpointsBase: 'window',
});

export const GutenbergCarouselAdapter = () => {
  useEffect(() => {
    const initializeSwipers = () => {
      const swiperElements = document.querySelectorAll<HTMLElement>('.swiper');

      swiperElements.forEach((swiperElement) => {
        const carouselBlock = swiperElement.closest('.cb-carousel-block');
        if (!carouselBlock) {
          return;
        }
        const attributes = parseCarouselAttributes(carouselBlock);
        const config = createSwiperConfig(carouselBlock, attributes);
        const queryTemplate = swiperElement.querySelector(`.${QUERY_SLIDE_CLASS}`);

        new Swiper(swiperElement, queryTemplate ? { ...config, slideClass: QUERY_SLIDE_CLASS } : config);
      });
    };

    initializeSwipers();
  }, []);

  return null;
};
