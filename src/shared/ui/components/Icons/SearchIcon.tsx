import { BaseIconProps } from './types';
import Search from '@/ui/assets/icons/search.svg';

export const SearchIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Search color={color} width={size} height={size} ref={ref} {...props} />
);
