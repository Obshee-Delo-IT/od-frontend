import ArrowRight from '@/shared/ui/assets/icons/arrow-right.svg';
import { BaseIconProps } from './types';

export const ArrowRightIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ArrowRight color={color} width={size} height={size} ref={ref} {...props} />
);
