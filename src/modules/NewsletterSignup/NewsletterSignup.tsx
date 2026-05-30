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

export interface NewsletterSignupProps {
  variant?: 'card' | 'bare';
  title?: string;
  submitLabel?: string;
  placeholder?: string;
  className?: string;
}

export const NewsletterSignup: React.FC<NewsletterSignupProps> = ({
  variant = 'card',
  title = 'Подписаться на новости',
  submitLabel = 'Подписаться',
  placeholder = 'Адрес электронной почты',
  className,
}) => {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Submission wiring is tracked in #54 (B6 forms backend).
  };

  return (
    <form className={clsx(css.root, variant === 'card' && css.card, className)} onSubmit={handleSubmit}>
      <Heading as="h2" size="7" weight="bold" className={css.title}>
        {title}
      </Heading>
      <div className={css.form}>
        <div className={css.fields}>
          <Input
            type="email"
            color="gray"
            placeholder={placeholder}
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
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
