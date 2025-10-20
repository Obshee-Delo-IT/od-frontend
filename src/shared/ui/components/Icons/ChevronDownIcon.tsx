import ChevronDown from '@/shared/ui/assets/icons/chevron-down.svg';
import { BaseIconProps } from './types';

export const ChevronDownIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronDown color={color} width={size} height={size} ref={ref} {...props} />
);
