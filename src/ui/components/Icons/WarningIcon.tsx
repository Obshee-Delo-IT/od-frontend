import Warning from '@/ui/assets/icons/warning.svg';
import { BaseIconProps } from './types';

export const WarningIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <Warning color={color} width={size} height={size} ref={ref} />
);
