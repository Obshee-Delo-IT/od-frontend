import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Carousel } from './Carousel';

describe('<Carousel />', () => {
  it('renders each child as a slide and exposes an aria-label on the carousel landmark', () => {
    render(
      <Carousel ariaLabel="Фильмы">{[<div key="a">A</div>, <div key="b">B</div>, <div key="c">C</div>]}</Carousel>
    );

    expect(screen.getByRole('region', { name: 'Фильмы' })).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('renders prev/next controls with Russian aria-labels', () => {
    render(<Carousel>{[<div key="a">A</div>, <div key="b">B</div>]}</Carousel>);

    expect(screen.getByRole('button', { name: 'Назад' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вперёд' })).toBeInTheDocument();
  });
});
