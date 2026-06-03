import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tabs, type TabItem } from './Tabs';

const ITEMS: TabItem[] = [
  { label: 'Все фильмы', value: 'all', href: '/video' },
  { label: 'Мультфильмы', value: 'cartoons', href: '/video?type=cartoons' },
  { label: 'Скоро', value: 'soon', href: '/video?type=soon', disabled: true },
];

describe('<Tabs />', () => {
  it('renders each enabled tab as a link to its href', () => {
    render(<Tabs items={ITEMS} activeValue="all" />);

    expect(screen.getByRole('link', { name: 'Все фильмы' })).toHaveAttribute('href', '/video');
    expect(screen.getByRole('link', { name: 'Мультфильмы' })).toHaveAttribute('href', '/video?type=cartoons');
  });

  it('flags the active tab with aria-current="page"', () => {
    render(<Tabs items={ITEMS} activeValue="cartoons" />);

    expect(screen.getByRole('link', { name: 'Мультфильмы' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Все фильмы' })).not.toHaveAttribute('aria-current');
  });

  it('renders a disabled tab as a non-interactive span', () => {
    render(<Tabs items={ITEMS} activeValue="all" />);

    expect(screen.queryByRole('link', { name: 'Скоро' })).toBeNull();
    const disabled = screen.getByText('Скоро');
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
  });
});
