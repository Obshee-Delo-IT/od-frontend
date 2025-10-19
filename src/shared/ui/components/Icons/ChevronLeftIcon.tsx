import { BaseIconProps } from './types';
import ChevronLeft from '@/ui/assets/icons/chevron-left.svg';

export const ChevronLeftIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronLeft color={color} width={size} height={size} ref={ref} {...props} />
);
