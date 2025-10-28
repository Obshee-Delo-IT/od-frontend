import clsx from 'clsx';
import React from 'react';
import css from './Box.module.css';

type SpacingValue = 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 56 | 64;

type DisplayValue = 'block' | 'inline' | 'inline-block' | 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | 'none';

type FlexDirectionValue = 'row' | 'row-reverse' | 'column' | 'column-reverse';

type FlexWrapValue = 'nowrap' | 'wrap' | 'wrap-reverse';

type JustifyContentValue = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';

type AlignItemsValue = 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';

type AlignContentValue = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'stretch';

type PositionValue = 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';

type CoordinateValue = 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 56 | 64;

interface ResponsiveValue<T> {
  mobile?: T;
  smallDesktop?: T;
  desktop?: T;
}

type Spacing = SpacingValue | ResponsiveValue<SpacingValue>;
type Display = DisplayValue | ResponsiveValue<DisplayValue>;
type FlexDirection = FlexDirectionValue | ResponsiveValue<FlexDirectionValue>;
type FlexWrap = FlexWrapValue | ResponsiveValue<FlexWrapValue>;
type JustifyContent = JustifyContentValue | ResponsiveValue<JustifyContentValue>;
type AlignItems = AlignItemsValue | ResponsiveValue<AlignItemsValue>;
type AlignContent = AlignContentValue | ResponsiveValue<AlignContentValue>;
type Position = PositionValue | ResponsiveValue<PositionValue>;
type Coordinate = CoordinateValue | ResponsiveValue<CoordinateValue>;

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
  display?: Display;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  justifyContent?: JustifyContent;
  alignItems?: AlignItems;
  alignContent?: AlignContent;
  gap?: Spacing;
  position?: Position;
  top?: Coordinate;
  bottom?: Coordinate;
  left?: Coordinate;
  right?: Coordinate;
};

export type BoxProps<T extends keyof HTMLElementTagNameMap = 'div'> = BoxOwnProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof BoxOwnProps<T>>;

const getSpacingClass = (
  spacing: Spacing | undefined,
  type: 'p' | 'm' | 'gap',
  direction: 't' | 'r' | 'b' | 'l' | 'x' | 'y' | '' = ''
) => {
  if (spacing === undefined) {
    return undefined;
  }

  const prefix = type === 'gap' ? 'gap' : `${type}${direction}`;

  if (typeof spacing === 'number') {
    return css[`${prefix}-${spacing}`];
  }

  return clsx(
    spacing.mobile !== undefined && css[`${prefix}-mobile-${spacing.mobile}`],
    spacing.smallDesktop !== undefined && css[`${prefix}-smallDesktop-${spacing.smallDesktop}`],
    spacing.desktop !== undefined && css[`${prefix}-desktop-${spacing.desktop}`]
  );
};

const getPropertyClass = <T extends string>(
  value: T | { mobile?: T; smallDesktop?: T; desktop?: T } | undefined,
  property: string
) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return css[`${property}-${value}`];
  }

  return clsx(
    value.mobile !== undefined && css[`${property}-mobile-${value.mobile}`],
    value.smallDesktop !== undefined && css[`${property}-smallDesktop-${value.smallDesktop}`],
    value.desktop !== undefined && css[`${property}-desktop-${value.desktop}`]
  );
};

const getCoordinateClass = (coordinate: Coordinate | undefined, property: 'top' | 'bottom' | 'left' | 'right') => {
  if (coordinate === undefined) {
    return undefined;
  }

  if (typeof coordinate === 'number') {
    return css[`${property}-${coordinate}`];
  }

  return clsx(
    coordinate.mobile !== undefined && css[`${property}-mobile-${coordinate.mobile}`],
    coordinate.smallDesktop !== undefined && css[`${property}-smallDesktop-${coordinate.smallDesktop}`],
    coordinate.desktop !== undefined && css[`${property}-desktop-${coordinate.desktop}`]
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
  display,
  flexDirection,
  flexWrap,
  justifyContent,
  alignItems,
  alignContent,
  gap,
  position,
  top,
  bottom,
  left,
  right,
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
    getSpacingClass(gap, 'gap'),
    getPropertyClass(display, 'display'),
    getPropertyClass(flexDirection, 'flex-direction'),
    getPropertyClass(flexWrap, 'flex-wrap'),
    getPropertyClass(justifyContent, 'justify-content'),
    getPropertyClass(alignItems, 'align-items'),
    getPropertyClass(alignContent, 'align-content'),
    getPropertyClass(position, 'position'),
    getCoordinateClass(top, 'top'),
    getCoordinateClass(bottom, 'bottom'),
    getCoordinateClass(left, 'left'),
    getCoordinateClass(right, 'right'),
    className
  );

  return React.createElement(
    Component,
    { ...props, className: combinedClassName } as React.ComponentPropsWithoutRef<T>,
    children
  );
};
