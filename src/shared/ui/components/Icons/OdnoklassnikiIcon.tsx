import Odnoklassniki from '@/shared/ui/assets/icons/odnoklassniki.svg';
import { BaseIconProps } from './types';

export const OdnoklassnikiIcon: React.FC<BaseIconProps> = ({ ref, color, size = 30, ...props }) => (
  <Odnoklassniki color={color} width={size} height={size} ref={ref} {...props} />
);
