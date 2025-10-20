'use client';

import { useEffect } from 'react';
import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import type { SwiperOptions } from 'swiper/types';

interface CarouselBlockAttributes {
  slidesPerView: number;
  slidesPerGroup: number;
  spaceBetween: number;
  speed: number;
  hasNavigation: boolean;
  hasPagination: boolean;
  loop: boolean;
  autoplay: false | { delay: number; disableOnInteraction: boolean };
  breakpoints: Record<string, unknown>;
}

const parseCarouselAttributes = (carouselBlock: Element): CarouselBlockAttributes => {
  const getIntAttribute = (name: string, defaultValue: string): number =>
    parseInt(carouselBlock.getAttribute(name) || defaultValue, 10);

  const getBooleanAttribute = (name: string): boolean => carouselBlock.getAttribute(name) === 'true';

  const hasAutoplay = getBooleanAttribute('data-cb-autoplay');

  return {
    slidesPerView: getIntAttribute('data-cb-slides-per-view', '1'),
    slidesPerGroup: getIntAttribute('data-cb-slides-per-group', '1'),
    spaceBetween: getIntAttribute('data-cb-space-between', '0'),
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
    breakpoints: JSON.parse(carouselBlock.getAttribute('data-cb-breakpoints') || '{}'),
  };
};

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

        new Swiper(swiperElement, config);
      });
    };

    initializeSwipers();
  }, []);

  return null;
};
