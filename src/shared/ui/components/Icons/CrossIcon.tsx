import { BaseIconProps } from './types';
import Cross from '@/ui/assets/icons/cross.svg';

export const CrossIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Cross color={color} width={size} height={size} ref={ref} {...props} />
);
