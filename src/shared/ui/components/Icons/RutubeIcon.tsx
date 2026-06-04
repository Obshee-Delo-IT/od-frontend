import Rutube from '@/shared/ui/assets/icons/rutube.svg';
import { BaseIconProps } from './types';

export const RutubeIcon: React.FC<BaseIconProps> = ({ ref, color, size = 30, ...props }) => (
  <Rutube color={color} width={size} height={size} ref={ref} {...props} />
);
