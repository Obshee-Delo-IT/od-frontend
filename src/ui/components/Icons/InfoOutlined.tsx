import InfoOutlined from '@/ui/assets/icons/info-outlined.svg';
import { BaseIconProps } from './types';

export const InfoOutlinedIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <InfoOutlined color={color} width={size} height={size} ref={ref} {...props} />
);
