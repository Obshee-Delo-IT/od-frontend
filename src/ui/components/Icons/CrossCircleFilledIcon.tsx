import CrossCircleFilled from '@/ui/assets/icons/cross-circle-filled.svg';
import { BaseIconProps } from './types';

export const CrossCircleFilledIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <CrossCircleFilled color={color} width={size} height={size} ref={ref} />
);
