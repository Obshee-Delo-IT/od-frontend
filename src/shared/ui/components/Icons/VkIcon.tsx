import Vk from '@/shared/ui/assets/icons/vk.svg';
import { BaseIconProps } from './types';

export const VkIcon: React.FC<BaseIconProps> = ({ ref, color, size = 30, ...props }) => (
  <Vk color={color} width={size} height={size} ref={ref} {...props} />
);
