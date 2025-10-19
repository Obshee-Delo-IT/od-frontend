import ExclamationOutlined from '@/shared/ui/assets/icons/exclamation-outlined.svg';
import { BaseIconProps } from './types';

export const ExclamationOutlinedIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <ExclamationOutlined color={color} width={size} height={size} ref={ref} {...props} />
);
