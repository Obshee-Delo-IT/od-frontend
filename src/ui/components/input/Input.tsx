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
      <TextField.Root
        placeholder={description}
        size="3"
        className={clsx(css.root, {
          [css.inputGray]: tone === 'gray',
          [css.inputRed]: tone === 'red',
        })}
        ref={ref}
        {...props}
      >
        <TextField.Slot side="left">123</TextField.Slot>
        {rightIcon && (
          <TextField.Slot className="zalupa" side="right">
            {rightIcon}
          </TextField.Slot>
        )}

        {leftIcon}
      </TextField.Root>
      <p
        className={clsx(css.message, {
          [css.messageGray]: tone === 'gray',
          [css.messageRed]: tone === 'red',
        })}
      >
        {message}
      </p>
    </div>
  )
);

Input.displayName = 'Input';

export { Input };
