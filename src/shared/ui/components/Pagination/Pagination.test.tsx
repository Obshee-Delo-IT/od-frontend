import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pagination } from './Pagination';

const buildHref = (page: number) => `/news?page=${page}`;

describe('<Pagination />', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} buildHref={buildHref} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the current page and links the others', () => {
    render(<Pagination currentPage={1} totalPages={18} buildHref={buildHref} />);

    const current = screen.getByRole('link', { name: 'Страница 1' });
    expect(current).toHaveAttribute('aria-current', 'page');

    expect(screen.getByRole('link', { name: 'Страница 2' })).toHaveAttribute('href', '/news?page=2');
    expect(screen.getByRole('link', { name: 'Страница 18' })).toHaveAttribute('href', '/news?page=18');
  });

  it('disables the previous arrow on the first page', () => {
    render(<Pagination currentPage={1} totalPages={18} buildHref={buildHref} />);

    expect(screen.queryByRole('link', { name: 'Предыдущая страница' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Следующая страница' })).toHaveAttribute('href', '/news?page=2');
  });

  it('disables the next arrow on the last page', () => {
    render(<Pagination currentPage={18} totalPages={18} buildHref={buildHref} />);

    expect(screen.queryByRole('link', { name: 'Следующая страница' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Предыдущая страница' })).toHaveAttribute('href', '/news?page=17');
  });
});
