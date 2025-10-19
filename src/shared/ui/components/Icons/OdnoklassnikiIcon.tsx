import { BaseIconProps } from './types';
import Odnoklassniki from '@/ui/assets/icons/odnoklassniki.svg';

export const OdnoklassnikiIcon: React.FC<BaseIconProps> = ({ ref, color, size = 30, ...props }) => (
  <Odnoklassniki color={color} width={size} height={size} ref={ref} {...props} />
);
