import Vk from '@/shared/ui/assets/icons/vk-circle.svg';
import { BaseIconProps } from './types';

// vk-circle.svg is the currentColor twin of vk.svg, which stays hardcoded
// white for the Footer's CSS background-image usage.
export const VkIcon: React.FC<BaseIconProps> = ({ ref, color = 'var(--gray-9)', size = 30, ...props }) => (
  <Vk color={color} width={size} height={size} ref={ref} {...props} />
);
