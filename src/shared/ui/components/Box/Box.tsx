import clsx from 'clsx';
import React from 'react';
import css from './Box.module.css';

/**
 * The layout shell: spacing, flex and position props with the project's three
 * breakpoints, on any element.
 *
 * Each set prop contributes one class per breakpoint and one inline custom
 * property carrying the value — see `Box.module.css`, which is 140 lines
 * because of it rather than the 3 528 it took to enumerate every property
 * against a fixed twelve-step scale. The scale is gone with it: `gap={18}` is
 * as valid as `gap={16}`, and `py="1rem"` works too.
 *
 * **The prop list is the list call sites use**, not every property a layout
 * shell could want: the other fifteen (`p`, `mx`, `justifyContent`, …) shipped
 * for a year with zero call sites. Adding one back is an entry in the type, an
 * entry in {@link LENGTH_PROPS} or {@link KEYWORD_PROPS}, and three lines per
 * breakpoint in the CSS.
 */

type Spacing = number | string;

type DisplayValue = 'block' | 'inline' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | 'none';
type FlexDirectionValue = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type PositionValue = 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';

interface ResponsiveValue<T> {
  mobile?: T;
  smallDesktop?: T;
  desktop?: T;
}

type Responsive<T> = T | ResponsiveValue<T>;

type BoxOwnProps<T extends keyof HTMLElementTagNameMap> = {
  children?: React.ReactNode;
  as?: T;
  pt?: Responsive<Spacing>;
  pb?: Responsive<Spacing>;
  py?: Responsive<Spacing>;
  mb?: Responsive<Spacing>;
  gap?: Responsive<Spacing>;
  top?: Responsive<Spacing>;
  display?: Responsive<DisplayValue>;
  flexDirection?: Responsive<FlexDirectionValue>;
  position?: Responsive<PositionValue>;
};

export type BoxProps<T extends keyof HTMLElementTagNameMap = 'div'> = BoxOwnProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof BoxOwnProps<T>>;

const BREAKPOINTS = ['mobile', 'smallDesktop', 'desktop'] as const;

/** Bare numbers are pixels, the unit every call site has ever meant. */
const length = (value: Spacing): string => (typeof value === 'number' ? `${value}px` : value);

/** Props whose value is a length, keyed by the CSS class stem they use. */
const LENGTH_PROPS = new Set(['pt', 'pb', 'py', 'mb', 'gap', 'top']);

/** Props whose value is a keyword, mapped from the React name to the CSS one. */
const KEYWORD_PROPS: Record<string, string> = {
  display: 'display',
  flexDirection: 'flex-direction',
  position: 'position',
};

export const Box = <T extends keyof HTMLElementTagNameMap = 'div'>({
  children,
  as,
  className,
  style,
  ...props
}: BoxProps<T>) => {
  const classes: Array<string | undefined> = [];
  const variables: Record<string, string> = {};
  const rest: Record<string, unknown> = {};

  const set = (name: string, value: Responsive<Spacing>, toCss: (value: Spacing) => string): void => {
    if (value !== null && typeof value === 'object') {
      for (const breakpoint of BREAKPOINTS) {
        const at = (value as ResponsiveValue<Spacing>)[breakpoint];
        if (at !== undefined) {
          classes.push(css[`${name}-${breakpoint}`]);
          variables[`--box-${name}-${breakpoint}`] = toCss(at);
        }
      }
      return;
    }
    classes.push(css[name]);
    variables[`--box-${name}`] = toCss(value);
  };

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) {
      continue;
    }
    if (LENGTH_PROPS.has(key)) {
      set(key, value as Responsive<Spacing>, length);
    } else if (KEYWORD_PROPS[key]) {
      set(KEYWORD_PROPS[key], value as Responsive<Spacing>, String);
    } else {
      rest[key] = value;
    }
  }

  const Component = (as || 'div') as T;

  return React.createElement(
    Component,
    {
      ...rest,
      className: clsx(classes, className),
      // The caller's own `style` wins: these are defaults it may want to override.
      style: { ...variables, ...style },
    } as React.ComponentPropsWithoutRef<T>,
    children
  );
};
