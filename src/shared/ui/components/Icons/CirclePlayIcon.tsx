import { BaseIconProps } from './types';
import CirclePlay from '@/ui/assets/icons/circle-play.svg';

export const CirclePlayIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <CirclePlay color={color} width={size} height={size} ref={ref} {...props} />
);
