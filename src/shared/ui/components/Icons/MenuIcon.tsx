import Menu from '@/shared/ui/assets/icons/menu.svg';
import { BaseIconProps } from './types';

export const MenuIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Menu color={color} width={size} height={size} ref={ref} {...props} />
);
