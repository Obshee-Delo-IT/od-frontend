import { BaseIconProps } from './types';
import ChevronRight from '@/ui/assets/icons/chevron-right.svg';

export const ChevronRightIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronRight color={color} width={size} height={size} ref={ref} {...props} />
);
