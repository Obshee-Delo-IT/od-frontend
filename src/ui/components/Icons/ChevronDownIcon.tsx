import ChevronDown from '@/ui/assets/icons/chevron-down.svg';
import { BaseIconProps } from './types';

export const ChevronDownIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <ChevronDown color={color} width={size} height={size} ref={ref} />
);
