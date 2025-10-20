import Warning from '@/shared/ui/assets/icons/warning.svg';
import { BaseIconProps } from './types';

export const WarningIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20, ...props }) => (
  <Warning color={color} width={size} height={size} ref={ref} {...props} />
);
