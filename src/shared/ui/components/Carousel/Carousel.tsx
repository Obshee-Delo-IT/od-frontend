'use client';

import clsx from 'clsx';
import { useId, useRef } from 'react';
import { A11y, Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperProps, SwiperSlide } from 'swiper/react';
import { IconButton } from '@/shared/ui/components/IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from '@/shared/ui/components/Icons';
import css from './Carousel.module.css';
import type { Swiper as SwiperType } from 'swiper';

export interface CarouselProps {
  items: React.ReactNode[];
  ariaLabel: string;
  slidesPerView?: SwiperProps['slidesPerView'];
  spaceBetween?: number;
  breakpoints?: SwiperProps['breakpoints'];
  showNavigation?: boolean;
  showPagination?: boolean;
  className?: string;
}

export const Carousel: React.FC<CarouselProps> = ({
  items,
  ariaLabel,
  slidesPerView = 3,
  spaceBetween = 24,
  breakpoints,
  showNavigation = true,
  showPagination = true,
  className,
}) => {
  const swiperRef = useRef<SwiperType | null>(null);
  const paginationId = `carousel-pagination-${useId().replace(/:/g, '')}`;

  return (
    <div aria-roledescription="carousel" aria-label={ariaLabel} className={clsx(css.root, className)}>
      <Swiper
        modules={[Navigation, Pagination, A11y]}
        slidesPerView={slidesPerView}
        spaceBetween={spaceBetween}
        breakpoints={breakpoints}
        pagination={
          showPagination
            ? {
                el: `#${paginationId}`,
                clickable: true,
                bulletClass: css.bullet,
                bulletActiveClass: css.bulletActive,
              }
            : false
        }
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        a11y={{ containerRoleDescriptionMessage: 'carousel', itemRoleDescriptionMessage: 'slide' }}
      >
        {items.map((item, idx) => (
          <SwiperSlide key={idx}>{item}</SwiperSlide>
        ))}
      </Swiper>

      <div className={css.controls}>
        {showNavigation && (
          <IconButton
            aria-label="Предыдущий слайд"
            radius="circle"
            variant="outline"
            onClick={() => swiperRef.current?.slidePrev()}
            className={css.navButton}
          >
            <ChevronLeftIcon size={16} />
          </IconButton>
        )}
        {showPagination && <div id={paginationId} className={css.pagination} />}
        {showNavigation && (
          <IconButton
            aria-label="Следующий слайд"
            radius="circle"
            variant="outline"
            onClick={() => swiperRef.current?.slideNext()}
            className={css.navButton}
          >
            <ChevronRightIcon size={16} />
          </IconButton>
        )}
      </div>
    </div>
  );
};
