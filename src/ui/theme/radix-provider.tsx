import { Theme } from '@radix-ui/themes';
import { PropsWithChildren } from 'react';

import '@radix-ui/themes/styles.css';
import './theme-override.css';

export const RadixProvider: React.FC<PropsWithChildren> = ({ children }) => (
  <Theme accentColor="red" radius="full">
    {children}
  </Theme>
);
