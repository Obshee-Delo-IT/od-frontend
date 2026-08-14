import { TextField } from '@radix-ui/themes';
import clsx from 'clsx';
import * as React from 'react';
import css from './Input.module.css';

type RootProps = React.ComponentPropsWithoutRef<typeof TextField.Root>;
type RootRef = React.ElementRef<typeof TextField.Root>;

/**
 * The two colours the app uses: `gray` on white (the newsletter form), `red` on
 * the red header bar.
 *
 * The Figma `Input` set also draws a label, a helper message, an error state and
 * a leading icon. All four shipped and none was ever passed — the two call sites
 * label their field with `aria-label` and validate with the native `required` —
 * so they are gone along with the wrapper `<div>` and the always-empty `<Text>`
 * this rendered under every input. Bring one back from Figma when a form needs
 * it, not before.
 */
type OwnProps = {
  rightIcon?: React.ReactNode;
  color?: 'gray' | 'red';
};

type InputProps = RootProps & OwnProps;

const Input = React.forwardRef<RootRef, InputProps>(({ rightIcon, color, ...props }, ref) => (
  <TextField.Root
    size="3"
    className={clsx({
      [css.inputGray]: color === 'gray',
      [css.inputRed]: color === 'red',
    })}
    ref={ref}
    {...props}
  >
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
));

Input.displayName = 'Input';

export { Input };
