import { Theme } from '@radix-ui/themes';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VideoCard } from './VideoCard';

const renderWithTheme = (ui: React.ReactNode) => render(<Theme>{ui}</Theme>);

describe('<VideoCard />', () => {
  it('renders the title and a present download with its meta', () => {
    renderWithTheme(
      <VideoCard
        title="Наркотики"
        downloadFull={{ url: 'https://disk.yandex.ru/i/full', duration: '30 мин', size: '872 Мб' }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Наркотики' })).toBeInTheDocument();
    expect(screen.getByText('Скачать фильм бесплатно')).toBeInTheDocument();
    expect(screen.getByText('30 мин · 872 Мб')).toBeInTheDocument();
    const download = screen.getByRole('link', { name: /Полная версия/ });
    expect(download).toHaveAttribute('href', 'https://disk.yandex.ru/i/full');
  });

  it('omits the download block entirely when no download is set', () => {
    renderWithTheme(<VideoCard title="Без скачивания" />);

    expect(screen.queryByText('Скачать фильм бесплатно')).not.toBeInTheDocument();
  });

  it('renders only the share platforms that have a url', () => {
    renderWithTheme(<VideoCard title="С шарингом" share={{ vk: 'https://vk.com/x', youtube: null, rutube: null }} />);

    expect(screen.getByRole('link', { name: 'VK Видео' })).toHaveAttribute('href', 'https://vk.com/x');
    expect(screen.queryByRole('link', { name: 'YouTube' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rutube' })).not.toBeInTheDocument();
  });

  it('wraps the poster in a watch link when watchUrl is provided', () => {
    renderWithTheme(
      <VideoCard title="Смотреть" watchUrl="https://watch.example/x" imageSrc="https://img.test/a.jpg" />
    );

    expect(screen.getByRole('link', { name: 'Смотреть «Смотреть»' })).toHaveAttribute(
      'href',
      'https://watch.example/x'
    );
  });
});
