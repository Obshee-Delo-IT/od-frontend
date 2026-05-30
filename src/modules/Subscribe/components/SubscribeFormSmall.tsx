import { Button, Checkbox, Heading, Text } from '@radix-ui/themes';
import { Box } from '@/shared/ui/components/Box';
import { Input } from '@/shared/ui/components/input';
import { Link } from '@/shared/ui/components/Link';
import { PERSONAL_DATA_LINK } from '../constants';
import css from './SubscribeFormSmall.module.css';

export const SubscribeFormSmall = () => (
  <Box className={css.root} as="form" gap={20} display="flex" flexDirection="column" p={20}>
    <Heading as="h3" size="5" weight="bold">
      Подписаться
    </Heading>
    <Box display="flex" gap={12} flexDirection="column">
      <Input type="email" placeholder="Адрес электронной почты" variant="soft" color="gray" />
      <Box display="inline-flex" alignItems="center" gap={12}>
        <Checkbox id="subscribe-form-small-check" />
        <Text as="label" htmlFor="subscribe-form-small-check" size="3">
          <span>Я согласен на</span>{' '}
          <Link underline="always" href={PERSONAL_DATA_LINK}>
            обработку персональных данных
          </Link>
        </Text>
      </Box>
    </Box>

    <Button type="submit" size="4">
      Подписаться
    </Button>
  </Box>
);
