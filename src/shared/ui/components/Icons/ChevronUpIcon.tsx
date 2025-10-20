import ChevronUp from '@/shared/ui/assets/icons/chevron-up.svg';
import { BaseIconProps } from './types';

export const ChevronUpIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ChevronUp color={color} width={size} height={size} ref={ref} {...props} />
);
