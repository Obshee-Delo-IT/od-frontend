import ChevronLeft from '@/ui/assets/icons/chevron-left.svg';
import { BaseIconProps } from './types';

export const ChevronLeftIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <ChevronLeft color={color} width={size} height={size} ref={ref} />
);
