'use client';

import { useEffect } from 'react';
import Swiper from 'swiper';
import { A11y, Navigation, Pagination, Autoplay } from 'swiper/modules';
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
  modules: [Navigation, Pagination, Autoplay, A11y],
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
  /* The plugin renders its arrows and bullets as bare `<div>`s: without this
     module they are unreachable by keyboard and unnamed to a screen reader. It
     supplies the roles, the tab stops and the live region — and its own copy is
     English, so every string it announces is replaced here. */
  a11y: {
    prevSlideMessage: 'Предыдущий слайд',
    nextSlideMessage: 'Следующий слайд',
    firstSlideMessage: 'Это первый слайд',
    lastSlideMessage: 'Это последний слайд',
    paginationBulletMessage: 'Перейти к слайду {{index}}',
    containerRoleDescriptionMessage: 'карусель',
    itemRoleDescriptionMessage: 'слайд',
  },
});

/** Swiper stamps itself onto the element it mounts on; this is that stamp. */
type CarouselElement = HTMLElement & { swiper?: Swiper };

export const GutenbergCarouselAdapter = () => {
  useEffect(() => {
    const mounted: Swiper[] = [];

    document.querySelectorAll<CarouselElement>('.swiper').forEach((swiperElement) => {
      const carouselBlock = swiperElement.closest('.cb-carousel-block');
      /* `swiper` already set means another adapter got here first: the scan is
         over the whole document, and a page can carry more than one provider —
         a news article renders one for the lifted header and one for the body.
         Mounting twice gave those pages doubled pagination bullets and two
         instances fighting over one element. */
      if (!carouselBlock || swiperElement.swiper) {
        return;
      }

      const attributes = parseCarouselAttributes(carouselBlock);
      const config = createSwiperConfig(carouselBlock, attributes);
      const queryTemplate = swiperElement.querySelector(`.${QUERY_SLIDE_CLASS}`);

      mounted.push(new Swiper(swiperElement, queryTemplate ? { ...config, slideClass: QUERY_SLIDE_CLASS } : config));
    });

    // Swiper attaches resize and pointer listeners of its own, so leaving the
    // instances behind on a client-side navigation leaks all of them.
    return () => mounted.forEach((swiper) => swiper.destroy());
  }, []);

  return null;
};
