import { BaseIconProps } from './types';
import Warning from '@/ui/assets/icons/warning.svg';

export const WarningIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Warning color={color} width={size} height={size} ref={ref} {...props} />
);
