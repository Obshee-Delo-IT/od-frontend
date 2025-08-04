import { TextField } from '@radix-ui/themes';
import clsx from 'clsx';
import * as React from 'react';
import css from './Input.module.css';

type RootProps = React.ComponentPropsWithoutRef<typeof TextField.Root>;
type RootRef = React.ElementRef<typeof TextField.Root>;

type OwnProps = {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  description?: string;
  message?: string;
  label?: string;
  error?: boolean;
  tone?: 'gray' | 'red';
};

type InputProps = RootProps & OwnProps;

const Input = React.forwardRef<RootRef, InputProps>(
  ({ leftIcon, rightIcon, description, message, label, error, tone, ...props }, ref) => (
    <div>
      <p
        className={clsx(css.label, {
          [css.labelGray]: tone === 'gray',
          [css.labelRed]: tone === 'red',
        })}
      >
        {label}
      </p>
      <TextField.Root
        placeholder={description}
        size="3"
        className={clsx(css.root, {
          [css.inputGray]: tone === 'gray',
          [css.inputRed]: tone === 'red',
          [css.errorGray]: error && tone == 'gray',
          [css.errorRed]: error && tone == 'red',
        })}
        ref={ref}
        {...props}
      >
        {leftIcon && (
          <TextField.Slot
            className={clsx(css.icon, css.leftIcon, {
              [css.iconGrayLeft]: tone === 'gray',
              [css.iconRed]: tone === 'red',
            })}
            side="left"
          >
            {leftIcon}
          </TextField.Slot>
        )}

        {rightIcon && (
          <TextField.Slot
            className={clsx(css.rightIcon, css.icon, {
              [css.iconGrayRight]: tone === 'gray',
              [css.iconRed]: tone === 'red',
            })}
            side="right"
          >
            {rightIcon}
          </TextField.Slot>
        )}
      </TextField.Root>
      <p
        className={clsx(css.message, {
          [css.messageGray]: tone === 'gray',
          [css.messageRed]: tone === 'red',
        })}
        data-error={!!error}
      >
        {message}
      </p>
    </div>
  )
);

Input.displayName = 'Input';

export { Input };
