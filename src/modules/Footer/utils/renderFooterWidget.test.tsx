import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderFooterWidget } from './renderFooterWidget';

// The shape WordPress actually returns for the first `sidebar_bottom` widget.
const SOCIAL_WIDGET = `
  <h2 class="wp-block-heading">
    <a class="cmsms-icon-vkontakte" title="VK" href="http://vk.com/obsheedelorf" target="_blank"> </a>
    <a class="cmsms-icon-odnoklassniki" title="instagram" href="http://ok.ru/obsheedelo" target="_blank"> </a>
    <a class="cmsms-icon-youtube-2" title="YouTube" href="https://www.youtube.com/user/proektobsheedelo" target="_blank"> </a>
  </h2>
`;

describe('renderFooterWidget', () => {
  it('gives each social anchor an icon and an accessible name', () => {
    render(<>{renderFooterWidget(SOCIAL_WIDGET)}</>);

    const vk = screen.getByRole('link', { name: 'ВКонтакте' });
    expect(vk).toHaveAttribute('href', 'http://vk.com/obsheedelorf');
    expect(vk.querySelector('svg')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Одноклассники' })).toHaveAttribute('href', 'http://ok.ru/obsheedelo');
    expect(screen.getByRole('link', { name: 'YouTube' })).toBeInTheDocument();
  });

  it('keeps the target and pairs it with rel', () => {
    render(<>{renderFooterWidget(SOCIAL_WIDGET)}</>);

    const vk = screen.getByRole('link', { name: 'ВКонтакте' });
    expect(vk).toHaveAttribute('target', '_blank');
    expect(vk).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('applies the caller class to the replaced anchors', () => {
    render(<>{renderFooterWidget(SOCIAL_WIDGET, 'social')}</>);

    expect(screen.getByRole('link', { name: 'ВКонтакте' })).toHaveClass('social');
  });

  it('demotes the textless social heading, keeping the class the layout needs', () => {
    const { container } = render(<>{renderFooterWidget(SOCIAL_WIDGET)}</>);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.querySelector('div.wp-block-heading')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ВКонтакте' })).toBeInTheDocument();
  });

  it('leaves ordinary widget markup alone', () => {
    render(
      <>
        {renderFooterWidget(
          '<div class="wp-block-group"><h2 class="wp-block-heading">ССЫЛКИ</h2><ul class="wp-block-list"><li><a href="/about/">О нас</a></li></ul></div>'
        )}
      </>
    );

    expect(screen.getByRole('heading', { name: 'ССЫЛКИ' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'О нас' });
    expect(link).toHaveAttribute('href', '/about/');
    expect(link).not.toHaveAttribute('rel');
  });

  it('does not touch an anchor that merely has other classes', () => {
    render(<>{renderFooterWidget('<a class="cmsms-icon-telegram" href="/tg/">TG</a>')}</>);

    expect(screen.getByRole('link', { name: 'TG' })).toBeInTheDocument();
  });
});
