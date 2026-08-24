'use client';

import { Text } from '@radix-ui/themes';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/shared/ui/components/Button';
import { Link } from '@/shared/ui/components/Link';
import css from './CookieNotice.module.css';

/**
 * The live site's notice, kept: same copy, same policy link, same cookie — only
 * the placement changes, from a full-width bar across the bottom to the small
 * corner card `edu.obshee-delo.ru` uses.
 *
 * **The cookie name is deliberately Clearfy's.** The notice on production is that
 * plugin's, and it stores consent in `clearfy_cookie_hide` on this same domain,
 * so reusing the name means a visitor who already accepted is not asked again
 * after the cutover — and the copies of the old notice that the A6 iframe still
 * carries stay hidden too, since they read that cookie themselves (the iframe is
 * served from our origin). Their pre-consent state is handled in
 * `transformLegacyHtml`, which hides `#clearfy-cookie` outright.
 */
const CONSENT_COOKIE = 'clearfy_cookie_hide';

/** Clearfy's own expiry, in `max-age` form. */
const ONE_YEAR_SECONDS = 31_536_000;

const POLICY_HREF = '/conf_politics';

const hasConsent = (): boolean =>
  document.cookie.split(';').some((entry) => entry.trim().startsWith(`${CONSENT_COOKIE}=`));

/**
 * `true` on the client, `false` in the server render and in the hydration pass
 * that has to match it — the standard subscription-free mount check, and the
 * reason there is no effect here. The cookie can only be read on the client,
 * and the route this renders on is statically generated, so a card in the HTML
 * would flash at every visitor who has already accepted.
 */
const useMounted = (): boolean =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

export const CookieNotice: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const mounted = useMounted();

  if (!mounted || dismissed || hasConsent()) {
    return null;
  }

  const accept = () => {
    document.cookie = `${CONSENT_COOKIE}=yes; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    setDismissed(true);
  };

  return (
    <aside className={css.root} aria-label="Использование cookie">
      <Text as="p" size="2" className={css.text}>
        Этот сайт использует cookie для хранения данных. Продолжая использовать сайт, Вы даете свое согласие на работу с
        этими файлами. Подробнее —{' '}
        <Link href={POLICY_HREF} size="2" underline="always" color="gray">
          Политика конфиденциальности
        </Link>
        .
      </Text>
      <Button size="xs" onClick={accept} className={css.accept}>
        OK
      </Button>
    </aside>
  );
};
