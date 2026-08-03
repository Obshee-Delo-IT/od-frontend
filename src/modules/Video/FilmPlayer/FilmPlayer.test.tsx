import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilmPlayer } from './FilmPlayer';

describe('<FilmPlayer />', () => {
  it('renders the Kinescope embed when a kinescope id is set', () => {
    render(<FilmPlayer title="Спасибо за жизнь" kinescopeId="abc123" watchUrl="https://watch.example/x" />);

    const iframe = screen.getByTitle('Спасибо за жизнь');
    expect(iframe).toHaveAttribute('src', 'https://kinescope.io/embed/abc123');
    expect(iframe).toHaveAttribute('allowfullscreen');
  });

  it('falls back to a watch-online poster link when there is no embed', () => {
    render(
      <FilmPlayer title="Наркотики" watchUrl="https://watch.example/narkotiki" posterUrl="https://cdn.test/p.jpg" />
    );

    const link = screen.getByRole('link', { name: 'Смотреть онлайн: Наркотики' });
    expect(link).toHaveAttribute('href', 'https://watch.example/narkotiki');
    expect(screen.getByText('Смотреть онлайн')).toBeInTheDocument();
  });

  it('renders the bare poster when there is neither embed nor watch url', () => {
    const { container } = render(<FilmPlayer title="Фильм" posterUrl="https://cdn.test/p.jpg" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('renders nothing when there is no stream and no poster', () => {
    const { container } = render(<FilmPlayer title="Пусто" />);

    expect(container).toBeEmptyDOMElement();
  });
});
