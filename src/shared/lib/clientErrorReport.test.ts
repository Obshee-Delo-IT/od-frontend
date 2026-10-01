import { describe, expect, it } from 'vitest';
import { clientErrorReport } from './clientErrorReport';

const ORIGIN = 'https://obshee-delo.ru';

const event = (fields: Partial<ErrorEvent>): ErrorEvent =>
  ({ message: 'boom', filename: `${ORIGIN}/_next/static/chunks/a.js`, lineno: 19, colno: 42, ...fields }) as ErrorEvent;

describe('clientErrorReport', () => {
  it('keeps an error thrown by this origin', () => {
    expect(clientErrorReport(event({}), ORIGIN)).toMatchObject({
      message: 'boom',
      source: `${ORIGIN}/_next/static/chunks/a.js`,
      line: 19,
      column: 42,
    });
  });

  /* React reports a recoverable hydration error through `reportError`, which
     surfaces with no frame at all — and that is the error being hunted. */
  it('keeps an error with no frame', () => {
    expect(clientErrorReport(event({ filename: '' }), ORIGIN)).toMatchObject({ message: 'boom', source: '' });
  });

  it.each(['chrome-extension://abc/inject.js', 'https://mc.yandex.ru/metrika/tag.js'])(
    'drops one thrown by %s',
    (filename) => {
      expect(clientErrorReport(event({ filename }), ORIGIN)).toBeNull();
    }
  );

  /* Measured on production 2026-09-27: the router's own `TypeError` arrived as
     `{"message":"Uncaught "}`, which names nothing. The error object had it. */
  it('prefers the thrown error over a browser message that says only «Uncaught»', () => {
    const error = new TypeError("Failed to construct 'URL': Invalid URL");

    expect(clientErrorReport(event({ message: 'Uncaught ', error }), ORIGIN)?.message).toBe(
      "TypeError: Failed to construct 'URL': Invalid URL"
    );
  });

  it('falls back to the browser message when nothing was thrown as an Error', () => {
    expect(clientErrorReport(event({ message: 'Script error.', error: null }), ORIGIN)?.message).toBe('Script error.');
  });

  it('drops an empty message, which says nothing and still costs a request', () => {
    expect(clientErrorReport(event({ message: '' }), ORIGIN)).toBeNull();
  });

  it('bounds every field it copies', () => {
    const report = clientErrorReport(event({ message: 'x'.repeat(5000) }), ORIGIN);

    expect(report?.message).toHaveLength(300);
  });
});

describe('clientErrorReport — where the page was when it broke', () => {
  it('reports the referrer and the children of <html>', () => {
    const event = new ErrorEvent('error', {
      error: new Error('boom'),
      filename: 'https://obshee-delo.ru/chunk.js',
    });

    const report = clientErrorReport(event, 'https://obshee-delo.ru');

    expect(report?.top).toBe('HEAD,BODY');
    expect(report?.referrer).toBe(document.referrer);
  });

  it('carries both snapshots of <body>, so a DOM change before hydration shows', () => {
    document.body.innerHTML = '<main></main>';
    const event = new ErrorEvent('error', {
      error: new Error('boom'),
      filename: 'https://obshee-delo.ru/chunk.js',
    });

    const unchanged = clientErrorReport(event, 'https://obshee-delo.ru', 'MAIN');
    expect(unchanged?.bodyBefore).toBe('MAIN');
    expect(unchanged?.bodyAfter).toBe('MAIN');

    document.body.insertAdjacentHTML('beforeend', '<div id="injected"></div>');
    const changed = clientErrorReport(event, 'https://obshee-delo.ru', 'MAIN');
    expect(changed?.bodyBefore).toBe('MAIN');
    expect(changed?.bodyAfter).toBe('MAIN,DIV');
  });

  it('collapses a run of the same tag', () => {
    document.body.innerHTML = '<main></main><script></script><script></script><script></script>';
    const event = new ErrorEvent('error', {
      error: new Error('boom'),
      filename: 'https://obshee-delo.ru/chunk.js',
    });

    expect(clientErrorReport(event, 'https://obshee-delo.ru')?.bodyAfter).toBe('MAIN,SCRIPT×3');
  });

  it('shows a node no part of this app rendered', () => {
    const injected = document.createElement('div');
    document.documentElement.append(injected);

    const event = new ErrorEvent('error', {
      error: new Error('boom'),
      filename: 'https://obshee-delo.ru/chunk.js',
    });

    expect(clientErrorReport(event, 'https://obshee-delo.ru')?.top).toBe('HEAD,BODY,DIV');

    injected.remove();
  });
});
