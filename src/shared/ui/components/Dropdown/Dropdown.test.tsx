import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dropdown, type DropdownOption } from './Dropdown';

const OPTIONS: DropdownOption[] = [
  { label: 'Все', value: 'all' },
  { label: 'Фильмы', value: 'movies' },
  { label: 'Мультфильмы', value: 'cartoons' },
];

const renderWithTheme = (ui: React.ReactNode) => render(<Theme>{ui}</Theme>);

describe('<Dropdown />', () => {
  it('renders the label and associates it with the trigger', () => {
    renderWithTheme(<Dropdown options={OPTIONS} label="Подобрать фильм по теме" placeholder="Выбрать" />);

    const label = screen.getByText('Подобрать фильм по теме');
    const trigger = screen.getByRole('combobox', { name: 'Подобрать фильм по теме' });
    expect(label).toHaveAttribute('for', trigger.getAttribute('id'));
  });

  it('shows the placeholder when no value is selected', () => {
    renderWithTheme(<Dropdown options={OPTIONS} aria-label="Категория" placeholder="Выбрать" />);

    expect(screen.getByRole('combobox', { name: 'Категория' })).toHaveTextContent('Выбрать');
  });

  it('shows the selected option label in the trigger', () => {
    renderWithTheme(<Dropdown options={OPTIONS} aria-label="Категория" value="cartoons" />);

    expect(screen.getByRole('combobox', { name: 'Категория' })).toHaveTextContent('Мультфильмы');
  });
});
