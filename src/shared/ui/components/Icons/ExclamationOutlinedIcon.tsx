import { BaseIconProps } from './types';
import ExclamationOutlined from '@/ui/assets/icons/exclamation-outlined.svg';

export const ExclamationOutlinedIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ExclamationOutlined color={color} width={size} height={size} ref={ref} {...props} />
);
