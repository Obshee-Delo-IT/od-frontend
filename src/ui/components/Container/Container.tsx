import { PropsWithChildren } from 'react';
import css from './Container.module.css';

interface ContainerProps {
  tag?: keyof HTMLElementTagNameMap;
}

export const Container: React.FC<PropsWithChildren<ContainerProps>> = ({ children, tag = 'main' }) => {
  const Tag = tag;

  return <Tag className={css.container}>{children}</Tag>;
};
