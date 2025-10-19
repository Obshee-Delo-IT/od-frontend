import { BaseIconProps } from './types';
import Menu from '@/ui/assets/icons/menu.svg';

export const MenuIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Menu color={color} width={size} height={size} ref={ref} {...props} />
);
