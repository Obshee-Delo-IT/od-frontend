import { Text, TextField } from '@radix-ui/themes';
import clsx from 'clsx';
import * as React from 'react';
import css from './Input.module.css';

type RootProps = React.ComponentPropsWithoutRef<typeof TextField.Root>;
type RootRef = React.ElementRef<typeof TextField.Root>;

type OwnProps = {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  message?: string;
  label?: string;
  error?: boolean;
  color?: 'gray' | 'red';
};

type InputProps = RootProps & OwnProps;

const Input = React.forwardRef<RootRef, InputProps>(
  ({ leftIcon, rightIcon, message, label, error, color, id, ...props }, ref) => {
    const generatedId = React.useId();
    const resolvedId = id ?? generatedId;

    return (
      <div>
        {label && (
          <label
            htmlFor={resolvedId}
            className={clsx(css.label, {
              [css.labelGray]: color === 'gray',
              [css.labelRed]: color === 'red',
            })}
          >
            {label}
          </label>
        )}
        <TextField.Root
          id={resolvedId}
          size="3"
          className={clsx({
            [css.inputGray]: color === 'gray',
            [css.inputRed]: color === 'red',
            [css.error]: error,
            [css.disabled]: !!props.disabled,
          })}
          ref={ref}
          {...props}
        >
          {leftIcon && (
            <TextField.Slot
              className={clsx(css.icon, css.leftIcon, {
                [css.iconGrayLeft]: color === 'gray',
                [css.iconRed]: color === 'red',
              })}
              side="left"
            >
              {leftIcon}
            </TextField.Slot>
          )}

          {rightIcon && (
            <TextField.Slot
              className={clsx(css.rightIcon, css.icon, {
                [css.iconGrayRight]: color === 'gray',
                [css.iconRed]: color === 'red',
              })}
              side="right"
            >
              {rightIcon}
            </TextField.Slot>
          )}
        </TextField.Root>

        <Text
          size="2"
          className={clsx(css.message, {
            [css.messageGray]: color === 'gray',
            [css.messageRed]: color === 'red',
          })}
          data-error={!!error}
        >
          {message}
        </Text>
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
