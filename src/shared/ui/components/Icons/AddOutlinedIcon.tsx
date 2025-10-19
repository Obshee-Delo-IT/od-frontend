import { BaseIconProps } from './types';
import AddOutlined from '@/ui/assets/icons/add-outlined.svg';

export const AddOutlinedIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <AddOutlined color={color} width={size} height={size} ref={ref} />
);
