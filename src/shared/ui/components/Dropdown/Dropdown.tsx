'use client';

import { Select } from '@radix-ui/themes';
import clsx from 'clsx';
import { useId } from 'react';
import css from './Dropdown.module.css';

export interface DropdownOption {
  label: string;
  value: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Optional field label rendered above the trigger. */
  label?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Single-select dropdown from Figma `Dropdown Menu` (1324:4234): r6 trigger,
 * `--gray-4` border, chevron, optional label. Used by the video-filter
 * «Подобрать фильм по теме». (The multi-select + chips variant from the same
 * Figma set is not built yet — add when Materials needs it.)
 */
export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onValueChange,
  placeholder = 'Выбрать',
  label,
  name,
  disabled,
  className,
  'aria-label': ariaLabel,
}) => {
  const generatedId = useId();
  const triggerId = `dropdown-${generatedId}`;

  return (
    <div className={clsx(css.root, className)}>
      {label && (
        <label htmlFor={triggerId} className={css.label}>
          {label}
        </label>
      )}
      <Select.Root value={value} onValueChange={onValueChange} name={name} disabled={disabled}>
        <Select.Trigger
          id={triggerId}
          className={css.trigger}
          variant="surface"
          placeholder={placeholder}
          aria-label={ariaLabel ?? label}
        />
        <Select.Content className={css.content} position="popper" variant="solid">
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value} className={css.item}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </div>
  );
};
