import { describe, expect, it } from 'vitest';
import { serverErrorReport } from './serverErrorReport';

const request = { path: '/74794/', method: 'GET' };
const context = { routeType: 'render', routePath: '/[...slug]' };

const withDigest = (error: Error, digest: string): Error => Object.assign(error, { digest });

describe('serverErrorReport', () => {
  it('reports the error, the digest and the stack', () => {
    const error = withDigest(new Error('WP answered 503'), '2951913545');

    expect(serverErrorReport(error, request, context)).toMatchObject({
      message: 'Error: WP answered 503',
      digest: '2951913545',
      path: '/74794/',
      method: 'GET',
      routeType: 'render',
      routePath: '/[...slug]',
    });
  });

  it('keeps the stack, which is the half the browser never sees', () => {
    const report = serverErrorReport(new Error('boom'), request, context);

    expect(report?.stack).toContain('Error: boom');
    expect(report?.stack).toContain('serverErrorReport.test.ts');
  });

  it.each([['NEXT_NOT_FOUND'], ['NEXT_REDIRECT'], ['NEXT_HTTP_ERROR_FALLBACK;404']])(
    'drops %s — control flow, not a failure',
    (digest) => {
      expect(serverErrorReport(withDigest(new Error('n/a'), digest), request, context)).toBeNull();
    }
  );

  it('keeps DYNAMIC_SERVER_USAGE — that one is a production 500', () => {
    const error = withDigest(new Error('Route /[...slug] used `no-store`'), 'DYNAMIC_SERVER_USAGE');

    expect(serverErrorReport(error, request, context)?.digest).toBe('DYNAMIC_SERVER_USAGE');
  });

  it('reports an error thrown without a digest', () => {
    expect(serverErrorReport(new TypeError('fetch failed'), request, context)).toMatchObject({
      message: 'TypeError: fetch failed',
      digest: '',
    });
  });

  it('reports what was thrown when it was not an Error at all', () => {
    expect(serverErrorReport('just a string', request, context)?.message).toBe('just a string');
  });

  it.each([[''], ['   '], [null], [undefined]])('drops %p, which says nothing', (thrown) => {
    expect(serverErrorReport(thrown, request, context)).toBeNull();
  });

  it('caps the message and the stack', () => {
    const error = new Error('x'.repeat(5_000));
    error.stack = 'y'.repeat(5_000);
    const report = serverErrorReport(error, request, context);

    expect(report?.message.length).toBe(300);
    expect(report?.stack.length).toBe(1_200);
  });
});
