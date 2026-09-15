import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YandexMetrica } from './YandexMetrica';

/* The id is read at module load, and the modules under test are imported
   statically — so it has to be in the environment before those imports run,
   which is what `vi.hoisted` buys. A stand-in, not the real counter: this file
   is in a public repository for the same reason the id is not. */
const COUNTER_ID = vi.hoisted(() => {
  process.env.METRICA_COUNTER_ID = '12345678';
  return '12345678';
});

const mocks = vi.hoisted(() => ({ scripts: [] as Record<string, unknown>[], pathname: '/', search: '' }));

/* Captured rather than rendered: React sets a `<script>`'s content before it is
   appended, so a real one would run the loader against mc.yandex.ru in jsdom. */
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock('next/script', () => ({
  default: (props: Record<string, unknown>) => {
    mocks.scripts.push(props);
    return null;
  },
}));

const snippet = (): string => {
  const [script] = mocks.scripts;
  return ((script?.dangerouslySetInnerHTML as { __html: string } | undefined) ?? { __html: '' }).__html;
};

describe('YandexMetrica', () => {
  beforeEach(() => {
    mocks.scripts.length = 0;
  });

  it('loads the counter with the options its own settings page generates', () => {
    render(<YandexMetrica />);

    expect(mocks.scripts).toHaveLength(1);
    // `inline-script-id` is a lint error, but a missing id also breaks next/script's own dedup.
    expect(mocks.scripts[0].id).toBe('yandex-metrica');
    expect(mocks.scripts[0].strategy).toBe('afterInteractive');
    expect(snippet()).toContain('https://mc.yandex.ru/metrika/tag.js');
    expect(snippet()).toContain(`ym(${COUNTER_ID}, 'init', {`);
    expect(snippet()).toContain('clickmap:true');
    expect(snippet()).toContain('trackLinks:true');
    expect(snippet()).toContain('accurateTrackBounce:true');
    expect(snippet()).toContain('webvisor:true');
    // Generated alongside the four, and the reason the landing view is not left
    // to whatever `tag.js` resolves when it finishes loading.
    expect(snippet()).toContain('referrer: document.referrer');
    expect(snippet()).toContain('url: location.href');
  });

  /* Yandex's SPA setup, and the two halves only work together: `defer` turns off
     the automatic view, the `hit` on the next line sends it with the URL read
     there. Drop either and the landing view is lost or lands on the wrong page. */
  it('follows the SPA setup: defer, then the landing hit from the snippet', () => {
    render(<YandexMetrica />);

    expect(snippet()).toContain('defer: true');
    expect(snippet()).toContain(`ym(${COUNTER_ID}, 'hit', location.pathname + location.search)`);
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
    expect(ym.mock.calls).toEqual([[COUNTER_ID, 'hit', '/news/']]);

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
    expect(ym.mock.calls[1]).toEqual([COUNTER_ID, 'hit', '/news/?category=articles']);
  });

  /* The server render, not `render()`: React drops `<noscript>` children on the
     client, so the pixel only ever exists in the served HTML — which is the only
     place it can matter, since it is what a visitor without JavaScript sends. */
  it('renders nothing at all when no counter is configured', async () => {
    vi.stubEnv('METRICA_COUNTER_ID', '');
    vi.resetModules();
    const { YandexMetrica: Unconfigured } = await import('./YandexMetrica');

    expect(renderToStaticMarkup(<Unconfigured />)).toBe('');
    expect(mocks.scripts).toHaveLength(0);
    vi.unstubAllEnvs();
  });

  it('keeps the noscript pixel in the server HTML', () => {
    expect(renderToStaticMarkup(<YandexMetrica />)).toContain(
      `<noscript><div><img src="https://mc.yandex.ru/watch/${COUNTER_ID}"`
    );
  });
});
