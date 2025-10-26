import { Checkbox, Text, Heading, Button } from '@radix-ui/themes';
import { Box } from '@/shared/ui/components/Box';
import { Input } from '@/shared/ui/components/input';
import { Link } from '@/shared/ui/components/Link';
import css from './SubscribeToNewsSmall.module.css';
import { PERSONAL_DATA_LINK } from '../constants';

export const SubscribeToNewsSmall = () => (
  <Box className={css.root} as="form" gap={20} display="flex" flexDirection="column" p={20}>
    <Heading as="h3" size="5" weight="bold" color="gray">
      Подписаться
    </Heading>
    <Box display="flex" gap={12} flexDirection="column">
      <Input type="email" placeholder="Адрес электронной почты" />
      <Box display="inline-flex" alignItems="center" gap={12}>
        <Checkbox id="subscribe-to-news-check" />
        <Text as="label" htmlFor="subscribe-to-news-check" size="3">
          Я согласен на <Link href={PERSONAL_DATA_LINK}>обработку персональных данных</Link>
        </Text>
      </Box>
    </Box>

    <Button type="submit" size="4">
      Подписаться
    </Button>
  </Box>
);
