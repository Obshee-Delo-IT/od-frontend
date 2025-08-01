import ChevronUp from '@/ui/assets/icons/chevron-up.svg';
import { BaseIconProps } from './types';

export const ChevronUpIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <ChevronUp color={color} width={size} height={size} ref={ref} />
);
