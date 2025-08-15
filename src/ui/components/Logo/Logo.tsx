import clsx from 'clsx';
import Image from 'next/image';
import LogoIcon from '@/ui/assets/icons/logo.webp';
import css from './Logo.module.css';

interface LogoProps {
  size: 'sm' | 'lg';
}

export const Logo = ({ size }: LogoProps) => (
  <div>
    <Image
      src={LogoIcon}
      alt="Общее Дело"
      className={clsx(css.logo, {
        [css.small]: size === 'sm',
        [css.large]: size === 'lg',
      })}
    />
  </div>
);
