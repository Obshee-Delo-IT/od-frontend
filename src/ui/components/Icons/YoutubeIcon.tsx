import Youtube from '@/ui/assets/icons/youtube.svg';
import { BaseIconProps } from './types';

export const YoutubeIcon: React.FC<BaseIconProps> = ({ ref, color, size = 30, ...props }) => (
  <Youtube color={color} width={size} height={size} ref={ref} {...props} />
);
