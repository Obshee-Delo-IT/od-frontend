import { BaseIconProps } from './types';
import ArrowRight from '@/ui/assets/icons/arrow-right.svg';

export const ArrowRightIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ArrowRight color={color} width={size} height={size} ref={ref} {...props} />
);
