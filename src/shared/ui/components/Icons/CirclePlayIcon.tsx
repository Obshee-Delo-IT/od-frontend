import CirclePlay from '@/shared/ui/assets/icons/circle-play.svg';
import { BaseIconProps } from './types';

export const CirclePlayIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <CirclePlay color={color} width={size} height={size} ref={ref} {...props} />
);
