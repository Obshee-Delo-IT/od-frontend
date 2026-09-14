import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { METRICA_COUNTER_ID } from '@/shared/config/metrica';
import { YandexMetrica } from './YandexMetrica';

const mocks = vi.hoisted(() => ({ scripts: [] as Record<string, unknown>[] }));

/* Captured rather than rendered: React sets a `<script>`'s content before it is
   appended, so a real one would run the loader against mc.yandex.ru in jsdom. */
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

  it("loads production's counter with production's four options", () => {
    render(<YandexMetrica />);

    expect(mocks.scripts).toHaveLength(1);
    // `inline-script-id` is a lint error, but a missing id also breaks next/script's own dedup.
    expect(mocks.scripts[0].id).toBe('yandex-metrica');
    expect(mocks.scripts[0].strategy).toBe('afterInteractive');
    expect(snippet()).toContain('https://mc.yandex.ru/metrika/tag.js');
    expect(snippet()).toContain(`ym(${METRICA_COUNTER_ID}, "init", {`);
    expect(snippet()).toContain('clickmap:true');
    expect(snippet()).toContain('trackLinks:true');
    expect(snippet()).toContain('accurateTrackBounce:true');
    expect(snippet()).toContain('webvisor:true');
  });

  /* Yandex's snippet, unmodified: no `defer`, and no `hit` of our own. The SPA
     wiring is a deliberate non-goal here — see the component's second warning. */
  it("keeps Yandex's snippet unmodified", () => {
    render(<YandexMetrica />);

    expect(snippet()).not.toContain('defer');
    expect(snippet()).not.toContain('"hit"');
  });

  /* The server render, not `render()`: React drops `<noscript>` children on the
     client, so the pixel only ever exists in the served HTML — which is the only
     place it can matter, since it is what a visitor without JavaScript sends. */
  it('keeps the noscript pixel in the server HTML', () => {
    expect(renderToStaticMarkup(<YandexMetrica />)).toContain(
      `<noscript><div><img src="https://mc.yandex.ru/watch/${METRICA_COUNTER_ID}"`
    );
  });
});
