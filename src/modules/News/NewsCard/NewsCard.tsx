import { Text } from '@radix-ui/themes';
import dayjs from 'dayjs';
import parse from 'html-react-parser';
import Image from 'next/image';
import NextLink from 'next/link';
import { Box } from '@/shared/ui/components/Box';
import css from './NewsCard.module.css';

export interface NewsCardProps {
  id: number;
  date: string;
  title: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
}

export const NewsCard = ({ id, date, title, coverImageUrl, coverImageAlt }: NewsCardProps) => (
  <Box className={css.root} display="flex" flexDirection="column" gap={16}>
    {coverImageUrl ? (
      <div className={css.cover}>
        <Image src={coverImageUrl} alt={coverImageAlt ?? ''} fill sizes="(max-width: 900px) 100vw, 280px" />
      </div>
    ) : (
      <div className={css.cover} />
    )}
    <Text size="3" color="gray">
      {dayjs(date).format('DD.MM.YYYY')}
    </Text>
    <NextLink href={`/news/${id}`} className={css.title}>
      {parse(title)}
    </NextLink>
  </Box>
);
