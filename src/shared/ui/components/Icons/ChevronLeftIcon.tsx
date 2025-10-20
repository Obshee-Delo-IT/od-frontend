import ChevronLeft from '@/shared/ui/assets/icons/chevron-left.svg';
import { BaseIconProps } from './types';

export const ChevronLeftIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronLeft color={color} width={size} height={size} ref={ref} {...props} />
);
