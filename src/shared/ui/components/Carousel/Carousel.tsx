'use client';

import { useId, useRef, useState } from 'react';
import { A11y, Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperProps, SwiperSlide } from 'swiper/react';
import { IconButton } from '@/shared/ui/components/IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from '@/shared/ui/components/Icons';
import css from './Carousel.module.css';
import type { Swiper as SwiperType } from 'swiper';

interface CarouselProps {
  items: React.ReactNode[];
  ariaLabel: string;
  slidesPerView?: SwiperProps['slidesPerView'];
  spaceBetween?: number;
  breakpoints?: SwiperProps['breakpoints'];
}

export const Carousel: React.FC<CarouselProps> = ({
  items,
  ariaLabel,
  slidesPerView = 3,
  spaceBetween = 24,
  breakpoints,
}) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const paginationId = `carousel-pagination-${useId().replace(/:/g, '')}`;
  const [navState, setNavState] = useState({ isBeginning: true, isEnd: false, isLocked: false });

  const syncNav = (swiper: SwiperType) => {
    setNavState({ isBeginning: swiper.isBeginning, isEnd: swiper.isEnd, isLocked: swiper.isLocked });
  };

  return (
    <div aria-roledescription="карусель" aria-label={ariaLabel} className={css.root}>
      <Swiper
        modules={[Navigation, Pagination, A11y]}
        slidesPerView={slidesPerView}
        spaceBetween={spaceBetween}
        breakpoints={breakpoints}
        pagination={{
          el: `#${paginationId}`,
          clickable: true,
          bulletClass: css.bullet,
          bulletActiveClass: css.bulletActive,
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          syncNav(swiper);
        }}
        onSlideChange={syncNav}
        onResize={syncNav}
        onBreakpoint={syncNav}
        onLock={syncNav}
        onUnlock={syncNav}
        /* Russian, like every other string on `<html lang="ru">`: Swiper's
           defaults are English, and this component announced «carousel»,
           «slide» and «Go to slide 2» beside the WordPress adapter next to it,
           which already says «карусель» / «слайд» (A11Y-04). */
        a11y={{
          containerRoleDescriptionMessage: 'карусель',
          itemRoleDescriptionMessage: 'слайд',
          prevSlideMessage: 'Предыдущий слайд',
          nextSlideMessage: 'Следующий слайд',
          firstSlideMessage: 'Это первый слайд',
          lastSlideMessage: 'Это последний слайд',
          paginationBulletMessage: 'Перейти к слайду {{index}}',
        }}
      >
        {items.map((item, idx) => (
          <SwiperSlide key={idx}>{item}</SwiperSlide>
        ))}
      </Swiper>

      <div className={css.controls} data-locked={navState.isLocked || undefined}>
        <IconButton
          aria-label="Предыдущий слайд"
          radius="circle"
          variant="outline"
          disabled={navState.isBeginning}
          onClick={() => swiperRef.current?.slidePrev()}
          className={css.navButton}
        >
          <ChevronLeftIcon size={16} />
        </IconButton>
        <div id={paginationId} className={css.pagination} />
        <IconButton
          aria-label="Следующий слайд"
          radius="circle"
          variant="outline"
          disabled={navState.isEnd}
          onClick={() => swiperRef.current?.slideNext()}
          className={css.navButton}
        >
          <ChevronRightIcon size={16} />
        </IconButton>
      </div>
    </div>
  );
};
