import { BaseIconProps } from './types';
import Download from '@/ui/assets/icons/download.svg';

export const DownloadIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Download color={color} width={size} height={size} ref={ref} {...props} />
);
