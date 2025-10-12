import { PropsWithChildren } from 'react';
import css from './Container.module.css';

interface ContainerProps {
  as?: keyof HTMLElementTagNameMap;
}

export const Container: React.FC<PropsWithChildren<ContainerProps>> = ({ children, as = 'main' }) => {
  const Tag = as;

  return <Tag className={css.container}>{children}</Tag>;
};
