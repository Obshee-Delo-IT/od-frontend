import { Button as RadixButton, ButtonProps as RadixButtonProps } from '@radix-ui/themes';
import clsx from 'clsx';
import css from './Button.module.css';

type ButtonVariant = 'contained' | 'outline' | 'white';
type ButtonSize = 'large' | 'small' | 'xs';

type RadixOwn = Omit<RadixButtonProps, 'variant' | 'size' | 'color'>;

interface ButtonProps extends RadixOwn {
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

export const Button: React.FC<ButtonProps> = ({ variant = 'contained', size = 'large', className, ...props }) => (
  <RadixButton
    variant={variantToRadix[variant]}
    size={sizeToRadix[size]}
    className={clsx(css.button, css[`variant-${variant}`], css[`size-${size}`], className)}
    {...props}
  />
);
