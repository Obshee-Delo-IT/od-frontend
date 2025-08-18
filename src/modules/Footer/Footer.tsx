import { Container } from '@radix-ui/themes';
import { Logo } from '@/ui/components/Logo';
import css from './Footer.module.css';

export const Footer = () => (
  <div className={css.footer}>
    <Container size="4" className={css.container}>
      <Logo size="lg" />
    </Container>
  </div>
);
