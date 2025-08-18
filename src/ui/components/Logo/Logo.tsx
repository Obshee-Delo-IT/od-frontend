import { Text } from '@radix-ui/themes';
import clsx from 'clsx';
import Image from 'next/image';
import LogoIcon from '@/ui/assets/icons/logo.webp';
import css from './Logo.module.css';

interface LogoProps {
  size: 'sm' | 'lg';
  className?: string;
}

export const Logo = ({ size, className }: LogoProps) => (
  <div
    className={clsx(
      css.logo,
      {
        [css.sm]: size === 'sm',
        [css.lg]: size === 'lg',
      },
      className
    )}
  >
    <div className={css.icon}>
      <Image src={LogoIcon} alt="Общее Дело" />
    </div>
    <div>
      <Text className={css.name}>Общероссийская</Text>
      <Text className={css.name}>общественная</Text>
      <Text className={css.name}>организация</Text>
    </div>
  </div>
);
