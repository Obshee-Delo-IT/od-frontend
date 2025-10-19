import { BaseIconProps } from './types';
import ChevronUp from '@/ui/assets/icons/chevron-up.svg';

export const ChevronUpIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronUp color={color} width={size} height={size} ref={ref} {...props} />
);
