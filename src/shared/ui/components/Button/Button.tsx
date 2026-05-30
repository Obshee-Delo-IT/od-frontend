import { Button as RadixButton, ButtonProps as RadixButtonProps } from '@radix-ui/themes';
import clsx from 'clsx';
import { forwardRef } from 'react';
import css from './Button.module.css';

export type ButtonVariant = 'contained' | 'outline' | 'white';
export type ButtonSize = 'large' | 'small' | 'xs';

type RadixOwn = Omit<RadixButtonProps, 'variant' | 'size' | 'color'>;

export interface ButtonProps extends RadixOwn {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantToRadix: Record<ButtonVariant, RadixButtonProps['variant']> = {
  contained: 'solid',
  outline: 'outline',
  white: 'surface',
};

const sizeToRadix: Record<ButtonSize, RadixButtonProps['size']> = {
  large: '4',
  small: '3',
  xs: '2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'contained', size = 'large', className, ...props }, ref) => (
    <RadixButton
      ref={ref}
      variant={variantToRadix[variant]}
      size={sizeToRadix[size]}
      className={clsx(css.button, css[`variant-${variant}`], css[`size-${size}`], className)}
      {...props}
    />
  )
);

Button.displayName = 'Button';
