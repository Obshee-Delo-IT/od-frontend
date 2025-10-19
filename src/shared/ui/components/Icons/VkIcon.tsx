import { BaseIconProps } from './types';
import Vk from '@/ui/assets/icons/vk.svg';

export const VkIcon: React.FC<BaseIconProps> = ({ ref, color, size = 30, ...props }) => (
  <Vk color={color} width={size} height={size} ref={ref} {...props} />
);
