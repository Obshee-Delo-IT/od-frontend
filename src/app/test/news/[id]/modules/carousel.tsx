'use client';

import useEmblaCarousel from 'embla-carousel-react';
import Image from 'next/image';
import { useCallback } from 'react';
import css from './carousel.module.css';

export const Carousel = ({ images }: { images: string[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  return (
    <div className={css.wrapper}>
      <div className={css.viewport} ref={emblaRef}>
        <div className={css.container}>
          {images.map((src, i) => (
            <div className={css.slide} key={i}>
              <Image src={src} alt="" />
            </div>
          ))}
        </div>
      </div>
      <button className={css.prev} onClick={scrollPrev}>
        ‹
      </button>
      <button className={css.next} onClick={scrollNext}>
        ›
      </button>
    </div>
  );
};
