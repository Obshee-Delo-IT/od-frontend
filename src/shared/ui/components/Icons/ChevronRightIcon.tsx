import ChevronRight from '@/shared/ui/assets/icons/chevron-right.svg';
import { BaseIconProps } from './types';

export const ChevronRightIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronRight color={color} width={size} height={size} ref={ref} {...props} />
);
