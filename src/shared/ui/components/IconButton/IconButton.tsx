import { IconButton as RadixIconButton, IconButtonProps as RadixIconButtonProps } from '@radix-ui/themes';
import clsx from 'clsx';
import { forwardRef } from 'react';
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

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'outline', radius = 'curved', className, ...props }, ref) => (
    <RadixIconButton
      ref={ref}
      variant={variantToRadix[variant]}
      radius={radius === 'circle' ? 'full' : 'medium'}
      className={clsx(css.iconButton, css[`variant-${variant}`], css[`radius-${radius}`], className)}
      {...props}
    />
  )
);

IconButton.displayName = 'IconButton';
