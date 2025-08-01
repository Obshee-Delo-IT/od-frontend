import CirclePlay from '@/ui/assets/icons/circle-play.svg';
import { BaseIconProps } from './types';

export const CirclePlayIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <CirclePlay color={color} width={size} height={size} ref={ref} />
);
