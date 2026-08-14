'use client';

import { Heading } from '@radix-ui/themes';
import clsx from 'clsx';
import { useState } from 'react';
import { Button } from '@/shared/ui/components/Button';
import { Checkbox } from '@/shared/ui/components/Checkbox';
import { Input } from '@/shared/ui/components/input';
import { Link } from '@/shared/ui/components/Link';
import css from './NewsletterSignup.module.css';

const PERSONAL_DATA_LINK = '/personal-data';

const PLACEHOLDER = 'Адрес электронной почты';

export interface NewsletterSignupProps {
  /**
   * `card` is the wide banner that closes the home page and every index;
   * `narrow` is the same form stacked for the news article's sidebar, which
   * used to be a second, non-functional copy of this component.
   */
  variant?: 'card' | 'narrow';
  title?: string;
  className?: string;
}

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({
  variant = 'card',
  title = 'Подписаться на новости',
  className,
}) => {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Submission wiring is tracked in #54 (B6 forms backend).
  };

  const narrow = variant === 'narrow';

  return (
    <form className={clsx(css.root, css[variant], className)} onSubmit={handleSubmit}>
      {/* h3 in the sidebar: it sits under «Похожие новости», which is one. */}
      <Heading as={narrow ? 'h3' : 'h2'} size={narrow ? '5' : '7'} weight="bold" className={css.title}>
        {title}
      </Heading>
      <div className={css.form}>
        <div className={css.fields}>
          <Input
            type="email"
            color="gray"
            placeholder={PLACEHOLDER}
            aria-label={PLACEHOLDER}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Checkbox
            checked={consent}
            onCheckedChange={(value) => setConsent(value === true)}
            label={
              <>
                <span>Я согласен на </span>
                <Link href={PERSONAL_DATA_LINK} underline="always" color="gray">
                  обработку персональных данных
                </Link>
              </>
            }
          />
        </div>
        <Button type="submit" disabled={!consent || !email} className={css.submit}>
          Подписаться
        </Button>
      </div>
    </form>
  );
};
