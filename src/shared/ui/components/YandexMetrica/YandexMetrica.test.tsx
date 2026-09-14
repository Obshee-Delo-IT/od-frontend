import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { METRICA_COUNTER_ID } from '@/shared/config/metrica';
import { YandexMetrica } from './YandexMetrica';

const mocks = vi.hoisted(() => ({
  scripts: [] as Record<string, unknown>[],
  pathname: '/',
  search: '',
}));

/* Captured rather than rendered: React sets a `<script>`'s content before it is
   appended, so a real one would run the loader against mc.yandex.ru in jsdom. */
vi.mock('next/script', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.scripts.push(props);
    return null;
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

const snippet = (): string => {
  const [script] = mocks.scripts;
  return ((script?.dangerouslySetInnerHTML as { __html: string } | undefined) ?? { __html: '' }).__html;
};

describe('YandexMetrica', () => {
  beforeEach(() => {
    mocks.scripts.length = 0;
  });

  it("loads production's counter with production's four options", () => {
    render(<YandexMetrica />);

    expect(mocks.scripts).toHaveLength(1);
    // `inline-script-id` is a lint error, but a missing id also breaks next/script's own dedup.
    expect(mocks.scripts[0].id).toBe('yandex-metrica');
    /* `beforeInteractive`, not `afterInteractive`: an inline `afterInteractive`
       script is not in the served HTML at all — next/script appends it from an
       effect — so a visit that ends before hydration would not be counted, and
       §4.9's gate greps the HTML for exactly this. */
    expect(mocks.scripts[0].strategy).toBe('beforeInteractive');
    expect(snippet()).toContain('https://mc.yandex.ru/metrika/tag.js');
    expect(snippet()).toContain(`ym(${METRICA_COUNTER_ID},"init",`);
    expect(snippet()).toContain('clickmap:true');
    expect(snippet()).toContain('trackLinks:true');
    expect(snippet()).toContain('accurateTrackBounce:true');
    expect(snippet()).toContain('webvisor:true');
  });

  /* The SPA pair, and they only work together: `defer` suppresses the automatic
     landing view, the explicit `hit` sends it with the URL read at that moment
     rather than whichever one is current when `tag.js` finishes loading. Drop
     either half and the landing view is lost or attributed to the wrong page. */
  it('defers the automatic view and sends the landing view itself', () => {
    render(<YandexMetrica />);

    expect(snippet()).toContain('defer:true');
    expect(snippet()).toContain(`ym(${METRICA_COUNTER_ID},"hit",location.pathname+location.search)`);
  });

  /* The server render, not `render()`: React drops `<noscript>` children on the
     client, so the pixel only ever exists in the served HTML — which is the only
     place it can matter, since it is what a visitor without JavaScript sends. */
  it('keeps the noscript pixel in the server HTML', () => {
    expect(renderToStaticMarkup(<YandexMetrica />)).toContain(
      `<noscript><div><img src="https://mc.yandex.ru/watch/${METRICA_COUNTER_ID}"`
    );
  });

  it('sends one hit per navigation and none for the landing view', async () => {
    const ym = vi.fn();
    window.ym = ym;
    mocks.pathname = '/';
    mocks.search = '';
    /* A fresh module: the guard this asserts is module state by design, so a copy
       already mounted by the tests above would make the landing case vacuous. */
    vi.resetModules();
    const { MetricaRouteHits } = await import('./MetricaRouteHits');

    /* Strict Mode on purpose: it is what the module-level URL guard exists for,
       and a `useRef` guard would send the landing view here. */
    const { rerender } = render(
      <StrictMode>
        <MetricaRouteHits />
      </StrictMode>
    );
    expect(ym).not.toHaveBeenCalled();

    mocks.pathname = '/news/';
    rerender(
      <StrictMode>
        <MetricaRouteHits />
      </StrictMode>
    );
    expect(ym.mock.calls).toEqual([[METRICA_COUNTER_ID, 'hit', '/news/']]);

    // A re-render that changes no URL is not a view.
    rerender(
      <StrictMode>
        <MetricaRouteHits />
      </StrictMode>
    );
    expect(ym).toHaveBeenCalledTimes(1);

    // The site paginates and filters by query alone, so the pathname cannot be the key.
    mocks.search = 'category=articles';
    rerender(
      <StrictMode>
        <MetricaRouteHits />
      </StrictMode>
    );
    expect(ym.mock.calls[1]).toEqual([METRICA_COUNTER_ID, 'hit', '/news/?category=articles']);
  });
});
