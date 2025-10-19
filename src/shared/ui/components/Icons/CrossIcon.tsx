import Cross from '@/shared/ui/assets/icons/cross.svg';
import { BaseIconProps } from './types';

export const CrossIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Cross color={color} width={size} height={size} ref={ref} {...props} />
);
