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

  it('drops an empty message, which says nothing and still costs a request', () => {
    expect(clientErrorReport(event({ message: '' }), ORIGIN)).toBeNull();
  });

  it('bounds every field it copies', () => {
    const report = clientErrorReport(event({ message: 'x'.repeat(5000) }), ORIGIN);

    expect(report?.message).toHaveLength(300);
  });
});
