import { BaseIconProps } from './types';
import CrossCircleFilled from '@/ui/assets/icons/cross-circle-filled.svg';

export const CrossCircleFilledIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <CrossCircleFilled color={color} width={size} height={size} ref={ref} {...props} />
);
