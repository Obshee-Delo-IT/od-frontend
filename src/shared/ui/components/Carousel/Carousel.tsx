'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useEffect, useState } from 'react';
import ChevronLeft from '@/shared/ui/assets/icons/chevron-left.svg';
import ChevronRight from '@/shared/ui/assets/icons/chevron-right.svg';
import css from './Carousel.module.css';

export interface CarouselProps {
  children: React.ReactNode[];
  ariaLabel?: string;
  slidesPerView?: number;
}

export const Carousel = ({ children, ariaLabel, slidesPerView = 3 }: CarouselProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }
    const updateState = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      setSnapCount(emblaApi.scrollSnapList().length);
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };

    updateState();
    emblaApi.on('select', updateState);
    emblaApi.on('reInit', updateState);
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const slideBasis = `${100 / slidesPerView}%`;

  return (
    <section className={css.root} aria-label={ariaLabel} aria-roledescription="carousel">
      <div className={css.viewport} ref={emblaRef}>
        <div className={css.container}>
          {children.map((child, index) => (
            <div
              key={index}
              className={css.slide}
              style={{ '--slide-basis': slideBasis } as React.CSSProperties}
              aria-roledescription="slide"
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      <div className={css.controls}>
        <button
          type="button"
          className={`${css.button} ${css.prev}`}
          onClick={scrollPrev}
          disabled={!canPrev}
          aria-label="Назад"
        >
          <ChevronLeft width={16} height={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${css.button} ${css.next}`}
          onClick={scrollNext}
          disabled={!canNext}
          aria-label="Вперёд"
        >
          <ChevronRight width={16} height={16} aria-hidden="true" />
        </button>
      </div>

      {snapCount > 1 ? (
        <div className={css.dots} role="tablist">
          {Array.from({ length: snapCount }).map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === selectedIndex}
              aria-label={`Слайд ${index + 1}`}
              className={`${css.dot} ${index === selectedIndex ? css.dotActive : ''}`}
              onClick={() => scrollTo(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};
