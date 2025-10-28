import { SubscribeToNewsSmall } from './components/SubscribeToNewsSmal';
interface SubscribeToNewsProps {
  variant: 'small' | 'default';
}

export const SubscribeToNews = ({ variant }: SubscribeToNewsProps) =>
  variant === 'small' ? <SubscribeToNewsSmall /> : <>Not inplemented</>;
