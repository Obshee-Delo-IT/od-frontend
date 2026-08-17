import { Theme } from '@radix-ui/themes';
import { PropsWithChildren } from 'react';

/**
 * The Radix Themes root.
 *
 * **Its two stylesheets are imported by `app/layout.tsx`, not here**, and
 * deliberately: they have to enter the module graph before any component's CSS
 * module or a production build lets Radix's own rules win every specificity tie
 * against a module class. The comment at the top of that file has the detail.
 * This component has exactly one consumer, so there is nowhere else for the
 * styles to be missing from.
 */
export const RadixProvider: React.FC<PropsWithChildren> = ({ children }) => (
  <Theme accentColor="red" radius="full">
    {children}
  </Theme>
);
