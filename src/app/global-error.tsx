'use client';

import { useEffect } from 'react';

/**
 * What a visitor sees when the client throws hard enough to take the root with
 * it — a hydration failure whose client re-render throws too, most of the time.
 *
 * Until this file existed that was Next's own fallback: «Application error: a
 * client-side exception has occurred while loading obshee-delo.ru (see the
 * browser console for more information)», in English, on a white page, with no
 * way forward. That is the screenshot readers sent.
 *
 * **It replaces the root layout, not the page.** There is no `<Theme>`, no
 * `global.css` and no font variable here — Next renders this module *instead of*
 * `app/layout.tsx`, which is why it owns `<html>`/`<body>` and why the styles
 * are inline rather than a module: a CSS module would work, but it would be a
 * second file describing one screen that must not itself be able to fail.
 *
 * ⚠ In `next dev` this never renders; the dev overlay takes the error first.
 * `next build && next start` is the only way to see it.
 */

const page = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: '24px',
  background: '#fff',
  color: '#1b1b1b',
  font: '16px/1.5 "PT Sans", system-ui, sans-serif',
} as const;

const button = {
  marginTop: '24px',
  padding: '12px 28px',
  border: 0,
  borderRadius: '999px',
  background: '#e02d2d',
  color: '#fff',
  font: 'inherit',
  cursor: 'pointer',
} as const;

const GlobalError: React.FC<{ error: Error & { digest?: string }; reset: () => void }> = ({ error, reset }) => {
  /**
   * The server never sees this one on its own: React hands a render error to
   * the boundary instead of rethrowing it at the window, so the `error`
   * listener in `instrumentation-client.ts` does not fire for it. `digest` is
   * the only thread back to a server log line when the throw began there.
   */
  useEffect(() => {
    navigator.sendBeacon?.(
      '/api/client-error/',
      JSON.stringify({
        message: `global-error: ${error.message}`.slice(0, 300),
        source: '',
        line: 0,
        column: 0,
        digest: error.digest ?? '',
        url: location.pathname + location.search,
      })
    );
  }, [error]);

  return (
    <html lang="ru">
      <body style={page}>
        <main style={{ maxWidth: '520px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Страница не загрузилась</h1>
          <p style={{ marginTop: '12px' }}>
            Что-то пошло не так при открытии страницы. Обычно помогает перезагрузка — содержимое никуда не делось.
          </p>
          {/* `reset` re-renders the tree; a plain reload is the fallback the
              visitor will reach for anyway, and is what actually clears a
              hydration failure. */}
          <button type="button" style={button} onClick={reset}>
            Обновить страницу
          </button>
          <p style={{ marginTop: '24px', fontSize: '14px' }}>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a
                `next/link` navigates with the router that has just died; this
                screen's only job is to get the visitor off it with a real
                document request. */}
            <a href="/" style={{ color: '#e02d2d' }}>
              На главную
            </a>
          </p>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
