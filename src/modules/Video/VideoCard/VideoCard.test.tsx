import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VideoCard } from './VideoCard';

const renderWithTheme = (ui: React.ReactNode) => render(<Theme>{ui}</Theme>);

describe('<VideoCard />', () => {
  it('renders the title, the «О фильме» link and a present download with its duration', () => {
    renderWithTheme(
      <VideoCard
        title="Наркотики"
        href="https://wp.test/films/narkotiki"
        downloadFull={{ url: 'https://disk.yandex.ru/i/full', duration: '30 мин', size: '872 Мб' }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Наркотики' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'О фильме' })).toHaveAttribute('href', 'https://wp.test/films/narkotiki');
    expect(screen.getByText('Скачать фильм бесплатно')).toBeInTheDocument();
    const download = screen.getByRole('link', { name: /Полн\. версия • 30 мин/ });
    expect(download).toHaveAttribute('href', 'https://disk.yandex.ru/i/full');
  });

  it('omits the download block and the trailer button when those fields are unset', () => {
    renderWithTheme(<VideoCard title="Без скачивания" href="https://wp.test/x" />);

    expect(screen.queryByText('Скачать фильм бесплатно')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Трейлер' })).not.toBeInTheDocument();
  });

  it('renders the trailer button only when a trailer url is provided', () => {
    renderWithTheme(<VideoCard title="С трейлером" href="https://wp.test/x" trailerUrl="https://trailer.example/x" />);

    expect(screen.getByRole('link', { name: 'Трейлер' })).toHaveAttribute('href', 'https://trailer.example/x');
  });

  it('renders only the share platforms that have a url', () => {
    renderWithTheme(
      <VideoCard
        title="С шарингом"
        href="https://wp.test/x"
        share={{ vk: 'https://vk.com/x', youtube: null, rutube: null }}
      />
    );

    expect(screen.getByRole('link', { name: 'VK Видео' })).toHaveAttribute('href', 'https://vk.com/x');
    expect(screen.queryByRole('link', { name: 'YouTube' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rutube' })).not.toBeInTheDocument();
  });
});
