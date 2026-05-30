import { SubscribeFormDefault } from './components/SubscribeFormDefault';
import { SubscribeFormSmall } from './components/SubscribeFormSmall';

interface SubscribeFormProps {
  variant?: 'small' | 'default';
}

export const SubscribeForm = ({ variant = 'default' }: SubscribeFormProps) =>
  variant === 'small' ? <SubscribeFormSmall /> : <SubscribeFormDefault />;
