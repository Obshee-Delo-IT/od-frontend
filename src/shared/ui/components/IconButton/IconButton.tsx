import { IconButton as RadixIconButton, IconButtonProps as RadixIconButtonProps } from '@radix-ui/themes';
import clsx from 'clsx';
import css from './IconButton.module.css';

export type IconButtonVariant = 'contained' | 'outline';
export type IconButtonRadius = 'curved' | 'circle';

type RadixOwn = Omit<RadixIconButtonProps, 'variant' | 'size' | 'color' | 'radius'>;

export interface IconButtonProps extends RadixOwn {
  variant?: IconButtonVariant;
  radius?: IconButtonRadius;
  'aria-label': string;
}

const variantToRadix: Record<IconButtonVariant, RadixIconButtonProps['variant']> = {
  contained: 'solid',
  outline: 'outline',
};

/**
 * `curved` maps to `large`, not `medium`. Radix stamps `data-radius` on the
 * element and rescales the whole radius scale beneath it, so `--radius-2` — 6px
 * app-wide, the `radius/2` token Figma draws these buttons with — collapses to
 * 4px inside a `medium` subtree. `large` carries the same 1.5 factor the app's
 * `Theme radius="full"` already sets.
 */
const radiusToRadix: Record<IconButtonRadius, RadixIconButtonProps['radius']> = {
  curved: 'large',
  circle: 'full',
};

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'outline',
  radius = 'curved',
  className,
  ...props
}) => (
  <RadixIconButton
    variant={variantToRadix[variant]}
    radius={radiusToRadix[radius]}
    className={clsx(css.iconButton, css[`variant-${variant}`], css[`radius-${radius}`], className)}
    {...props}
  />
);
