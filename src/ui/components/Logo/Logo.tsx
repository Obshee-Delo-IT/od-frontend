import Image from 'next/image';
import LogoIcon from '@/ui/assets/icons/logo.webp';

export const Logo = () => (
  <div>
    <Image src={LogoIcon} alt="Общее Дело" />
  </div>
);
