import ChevronRight from '@/ui/assets/icons/chevron-right.svg';
import { BaseIconProps } from './types';

export const ChevronRightIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <ChevronRight color={color} width={size} height={size} ref={ref} />
);
