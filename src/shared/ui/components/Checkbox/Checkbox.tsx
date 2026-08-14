import { Checkbox as RadixCheckbox, CheckboxProps as RadixCheckboxProps, Flex, Text } from '@radix-ui/themes';
import clsx from 'clsx';
import { ReactNode, useId } from 'react';
import css from './Checkbox.module.css';

type RadixOwn = Omit<RadixCheckboxProps, 'size' | 'variant'>;

export interface CheckboxProps extends RadixOwn {
  label?: ReactNode;
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, id, className, ...props }) => {
  const generatedId = useId();
  const resolvedId = id ?? generatedId;

  const checkbox = <RadixCheckbox id={resolvedId} className={clsx(css.checkbox, className)} {...props} />;

  if (!label) {
    return checkbox;
  }

  return (
    <Flex as="span" align="start" gap="2" className={css.row}>
      {checkbox}
      <Text as="label" htmlFor={resolvedId} size="2" className={css.label}>
        {label}
      </Text>
    </Flex>
  );
};
