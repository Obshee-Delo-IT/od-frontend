import clsx from 'clsx';
import React from 'react';
import css from './Box.module.css';

type SpacingValue = 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 56 | 64;

interface ResponsiveSpacing {
  mobile?: SpacingValue;
  smallDesktop?: SpacingValue;
  desktop?: SpacingValue;
}

type Spacing = SpacingValue | ResponsiveSpacing;

type BoxOwnProps<T extends keyof HTMLElementTagNameMap> = {
  children?: React.ReactNode;
  as?: T;
  p?: Spacing;
  pt?: Spacing;
  pr?: Spacing;
  pb?: Spacing;
  pl?: Spacing;
  px?: Spacing;
  py?: Spacing;
  m?: Spacing;
  mt?: Spacing;
  mr?: Spacing;
  mb?: Spacing;
  ml?: Spacing;
  mx?: Spacing;
  my?: Spacing;
};

type BoxProps<T extends keyof HTMLElementTagNameMap = 'div'> = BoxOwnProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof BoxOwnProps<T>>;

const getSpacingClass = (
  spacing: Spacing | undefined,
  type: 'p' | 'm',
  direction: 't' | 'r' | 'b' | 'l' | 'x' | 'y' | ''
) => {
  if (spacing === undefined) {
    return undefined;
  }

  const prefix = `${type}${direction}`;

  if (typeof spacing === 'number') {
    return css[`${prefix}-${spacing}`];
  }

  return clsx(
    spacing.mobile !== undefined && css[`${prefix}-mobile-${spacing.mobile}`],
    spacing.smallDesktop !== undefined && css[`${prefix}-smallDesktop-${spacing.smallDesktop}`],
    spacing.desktop !== undefined && css[`${prefix}-desktop-${spacing.desktop}`]
  );
};

export const Box = <T extends keyof HTMLElementTagNameMap = 'div'>({
  children,
  as,
  className,
  p,
  pt,
  pr,
  pb,
  pl,
  px,
  py,
  m,
  mt,
  mr,
  mb,
  ml,
  mx,
  my,
  ...props
}: BoxProps<T>) => {
  const Component = (as || 'div') as T;

  const combinedClassName = clsx(
    getSpacingClass(p, 'p', ''),
    getSpacingClass(pt, 'p', 't'),
    getSpacingClass(pr, 'p', 'r'),
    getSpacingClass(pb, 'p', 'b'),
    getSpacingClass(pl, 'p', 'l'),
    getSpacingClass(px, 'p', 'x'),
    getSpacingClass(py, 'p', 'y'),
    getSpacingClass(m, 'm', ''),
    getSpacingClass(mt, 'm', 't'),
    getSpacingClass(mr, 'm', 'r'),
    getSpacingClass(mb, 'm', 'b'),
    getSpacingClass(ml, 'm', 'l'),
    getSpacingClass(mx, 'm', 'x'),
    getSpacingClass(my, 'm', 'y'),
    className
  );

  return React.createElement(
    Component,
    { ...props, className: combinedClassName } as React.ComponentPropsWithoutRef<T>,
    children
  );
};
