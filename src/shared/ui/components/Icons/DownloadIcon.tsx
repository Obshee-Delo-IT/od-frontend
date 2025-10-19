import Download from '@/shared/ui/assets/icons/download.svg';
import { BaseIconProps } from './types';

export const DownloadIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Download color={color} width={size} height={size} ref={ref} {...props} />
);
