import AddOutlined from '@/shared/ui/assets/icons/add-outlined.svg';
import { BaseIconProps } from './types';

export const AddOutlinedIcon: React.FC<BaseIconProps> = ({ ref, color, size = 20 }) => (
  <AddOutlined color={color} width={size} height={size} ref={ref} />
);
