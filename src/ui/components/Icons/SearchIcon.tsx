import Search from '@/ui/assets/icons/search.svg';
import { BaseIconProps } from './types';

export const SearchIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <Search color={color} width={size} height={size} ref={ref} />
);
