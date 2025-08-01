import Menu from '@/ui/assets/icons/menu.svg';
import { BaseIconProps } from './types';

export const MenuIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <Menu color={color} width={size} height={size} ref={ref} />
);
