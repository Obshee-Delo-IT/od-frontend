import { Button, Checkbox, Heading, Text } from '@radix-ui/themes';
import { Box } from '@/shared/ui/components/Box';
import { Input } from '@/shared/ui/components/input';
import { Link } from '@/shared/ui/components/Link';
import { PERSONAL_DATA_LINK } from '../constants';
import css from './SubscribeFormDefault.module.css';

export const SubscribeFormDefault = () => (
  <Box
    className={css.root}
    as="form"
    display="flex"
    flexDirection="column"
    gap={20}
    p={{ mobile: 24, smallDesktop: 40 }}
  >
    <Heading as="h2" size="7" weight="bold" align="center">
      Подписаться на новости
    </Heading>

    <Box className={css.row} display="flex" gap={12}>
      <Box className={css.email}>
        <Input type="email" placeholder="Адрес электронной почты" variant="soft" color="gray" />
      </Box>
      <Button type="submit" size="4">
        Подписаться
      </Button>
    </Box>

    <Box display="inline-flex" alignItems="center" gap={12}>
      <Checkbox id="subscribe-form-default-check" />
      <Text as="label" htmlFor="subscribe-form-default-check" size="2">
        <span>Я согласен на</span>{' '}
        <Link underline="always" href={PERSONAL_DATA_LINK}>
          обработку персональных данных
        </Link>
      </Text>
    </Box>
  </Box>
);
