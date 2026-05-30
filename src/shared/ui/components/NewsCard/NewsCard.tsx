import { Heading, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import css from './NewsCard.module.css';

export interface NewsCardProps {
  href: string;
  title: string;
  date?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  className?: string;
}

export const NewsCard: React.FC<NewsCardProps> = ({ href, title, date, imageSrc, imageAlt = '', className }) => (
  <NextLink href={href} className={clsx(css.card, className)}>
    <div className={css.media}>
      {imageSrc ? (
        <Image src={imageSrc} alt={imageAlt} fill className={css.image} sizes="(max-width: 900px) 100vw, 320px" />
      ) : null}
    </div>
    <div className={css.body}>
      {date ? (
        <Text as="div" size="2" color="gray" className={css.date}>
          {date}
        </Text>
      ) : null}
      <Heading as="h3" size="4" weight="bold" className={css.title}>
        {title}
      </Heading>
    </div>
  </NextLink>
);
