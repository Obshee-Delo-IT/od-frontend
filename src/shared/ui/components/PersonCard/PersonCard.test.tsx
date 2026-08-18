import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PersonCard } from './PersonCard';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} {...rest} />;
  },
}));

const renderInTheme = (ui: React.ReactElement) => render(<Theme accentColor="red">{ui}</Theme>);

const CONTACTS = [
  { kind: 'phone' as const, href: 'tel:+79048180869', label: '+7(904)818-08-69' },
  { kind: 'telegram' as const, href: 'https://t.me/paramon1302', label: '@paramon1302' },
  { kind: 'vk' as const, href: 'https://vk.com/id39335667', label: 'https://vk.com/id39335667' },
];

describe('<PersonCard />', () => {
  it('renders the name, the subtitle and one link per contact, hrefs as given', () => {
    renderInTheme(
      <PersonCard name="Андрей Алексеевич Рязанов" subtitle="Координатор по городу Магнитогорску" contacts={CONTACTS} />
    );

    expect(screen.getByText('Андрей Алексеевич Рязанов')).toBeInTheDocument();
    expect(screen.getByText('Координатор по городу Магнитогорску')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('link', { name: '@paramon1302' })).toHaveAttribute('href', 'https://t.me/paramon1302');
    expect(screen.getByRole('link', { name: '+7(904)818-08-69' })).toHaveAttribute('href', 'tel:+79048180869');
  });

  it('draws no photo when the record has none — the `handbooks` banner variant', () => {
    renderInTheme(<PersonCard name="Х" contacts={CONTACTS} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('draws the photo when the record has one — the `team-1` variant', () => {
    renderInTheme(<PersonCard name="Х" photo={{ src: 'https://cdn.test/p.jpg', alt: 'Х' }} />);

    expect(screen.getByRole('img', { name: 'Х' })).toHaveAttribute('src', 'https://cdn.test/p.jpg');
  });

  it('survives a record with nothing but a name', () => {
    renderInTheme(<PersonCard name="Х" />);

    expect(screen.getByText('Х')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
