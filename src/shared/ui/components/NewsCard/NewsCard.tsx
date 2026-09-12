import { Heading, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import Image from 'next/image';
import NextLink from 'next/link';
import css from './NewsCard.module.css';

/** The media box's own proportions — keep in step with `.media`'s aspect-ratio. */
const CARD_RATIO = 280 / 216;

/**
 * Whether `cover` may crop this image, or whether it should be fitted whole.
 *
 * `cover` is right for a photograph and wrong for the covers the articles feed
 * carries: a 1568×682 banner or a scanned journal page prints the article's own
 * title *inside* the picture, and cropping it to a near-square box cuts those
 * words off at both edges. That is exactly the report this answers. An image
 * whose proportions are close to the box loses little and still fills it, so
 * the rule is a budget rather than a shape: crop up to a third away, fit the
 * rest whole. Unknown proportions crop, which is the old behaviour.
 */
export const cardImageFits = (ratio?: number | null): boolean => {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return true;
  }
  return Math.min(ratio, CARD_RATIO) / Math.max(ratio, CARD_RATIO) >= 2 / 3;
};

interface NewsCardProps {
  href: string;
  title: string;
  date?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  /** The image's intrinsic width/height, when it is known. See {@link cardImageFits}. */
  imageRatio?: number | null;
  className?: string;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  href,
  title,
  date,
  imageSrc,
  imageAlt = '',
  imageRatio,
  className,
}) => (
  <NextLink href={href} className={clsx(css.card, className)}>
    <div className={css.media}>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className={clsx(css.image, !cardImageFits(imageRatio) && css.whole)}
          sizes="(max-width: 900px) 100vw, 320px"
        />
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
