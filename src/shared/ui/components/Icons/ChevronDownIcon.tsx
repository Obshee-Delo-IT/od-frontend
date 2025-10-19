import { BaseIconProps } from './types';
import ChevronDown from '@/ui/assets/icons/chevron-down.svg';

export const ChevronDownIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronDown color={color} width={size} height={size} ref={ref} {...props} />
);
