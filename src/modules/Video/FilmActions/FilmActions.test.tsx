import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilmActions } from './FilmActions';

const renderWithTheme = (ui: React.ReactNode) => render(<Theme>{ui}</Theme>);

describe('<FilmActions />', () => {
  it('renders a pill per download variant and only the populated share platforms', () => {
    renderWithTheme(
      <FilmActions
        downloads={[
          { url: 'https://disk.yandex.ru/i/hd', label: 'Полн. версия • 35 мин • 1,5 Гб' },
          { url: 'https://disk.yandex.ru/i/sd', label: '656 Мб • 35 мин' },
        ]}
        share={{ vk: 'https://vk.com/x', youtube: null, rutube: null }}
      />
    );

    expect(screen.getByText('Скачать фильм бесплатно')).toBeInTheDocument();
    expect(screen.getByText('Смотреть онлайн')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Полн. версия • 35 мин • 1,5 Гб' })).toHaveAttribute(
      'href',
      'https://disk.yandex.ru/i/hd'
    );
    expect(screen.getByRole('link', { name: '656 Мб • 35 мин' })).toHaveAttribute(
      'href',
      'https://disk.yandex.ru/i/sd'
    );
    expect(screen.getByRole('link', { name: 'VK Видео' })).toHaveAttribute('href', 'https://vk.com/x');
    expect(screen.queryByRole('link', { name: 'YouTube' })).not.toBeInTheDocument();
  });

  it('renders the trailer pill without the downloads label when only a trailer is set', () => {
    renderWithTheme(<FilmActions trailerUrl="https://trailer.example/x" />);

    expect(screen.queryByText('Скачать фильм бесплатно')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Трейлер' })).toHaveAttribute('href', 'https://trailer.example/x');
  });

  it('renders nothing when every affordance is empty', () => {
    const { container } = renderWithTheme(<FilmActions share={{ vk: null, youtube: null, rutube: null }} />);

    expect(container.querySelector('section')).toBeNull();
  });
});
