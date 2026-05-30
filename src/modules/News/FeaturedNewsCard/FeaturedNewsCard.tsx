import { Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import parse from 'html-react-parser';
import Image from 'next/image';
import NextLink from 'next/link';
import { Box } from '@/shared/ui/components/Box';
import css from './FeaturedNewsCard.module.css';

export interface FeaturedNewsCardProps {
  id: number;
  date: string;
  title: string;
  excerpt?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
}

export const FeaturedNewsCard = ({ id, date, title, excerpt, coverImageUrl, coverImageAlt }: FeaturedNewsCardProps) => (
  <Box className={css.root} display="flex">
    <div className={css.cover}>
      {coverImageUrl ? (
        <Image src={coverImageUrl} alt={coverImageAlt ?? ''} fill sizes="(max-width: 900px) 100vw, 480px" />
      ) : null}
    </div>
    <Box className={css.body} display="flex" flexDirection="column" gap={16}>
      <Text size="3" color="gray">
        {dayjs(date).format('DD.MM.YYYY')}
      </Text>
      <NextLink href={`/news/${id}`} className={css.title}>
        {parse(title)}
      </NextLink>
      {excerpt ? <div className={css.excerpt}>{parse(excerpt)}</div> : null}
    </Box>
  </Box>
);
