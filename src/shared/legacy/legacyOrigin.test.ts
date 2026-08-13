import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLegacyOrigin } from './legacyOrigin';

describe('resolveLegacyOrigin (LCP-001)', () => {
  it('keeps a well-formed origin', () => {
    expect(resolveLegacyOrigin('https://obshee-delo.ru')).toBe('https://obshee-delo.ru');
  });

  it('discards a trailing slash, a stray path and a query', () => {
    expect(resolveLegacyOrigin('https://obshee-delo.ru/')).toBe('https://obshee-delo.ru');
    expect(resolveLegacyOrigin('https://obshee-delo.ru/some/path/')).toBe('https://obshee-delo.ru');
    expect(resolveLegacyOrigin('https://obshee-delo.ru/x?y=1#z')).toBe('https://obshee-delo.ru');
  });

  it('keeps an explicit port and trims surrounding whitespace', () => {
    expect(resolveLegacyOrigin('  http://localhost:8080/  ')).toBe('http://localhost:8080');
  });

  it('treats an absent or empty value as disabled', () => {
    expect(resolveLegacyOrigin(undefined)).toBeNull();
    expect(resolveLegacyOrigin(null)).toBeNull();
    expect(resolveLegacyOrigin('')).toBeNull();
    expect(resolveLegacyOrigin('   ')).toBeNull();
  });

  it('treats an unparseable value as disabled rather than throwing', () => {
    expect(resolveLegacyOrigin('not a url')).toBeNull();
    expect(resolveLegacyOrigin('obshee-delo.ru')).toBeNull();
    expect(resolveLegacyOrigin('//obshee-delo.ru')).toBeNull();
  });

  it('refuses a scheme that is not http(s)', () => {
    expect(resolveLegacyOrigin('file:///etc/passwd')).toBeNull();
    expect(resolveLegacyOrigin('data:text/html,<b>x</b>')).toBeNull();
    expect(resolveLegacyOrigin('javascript:alert(1)')).toBeNull();
  });
});

describe('the module read of WP_LEGACY_BASE', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('resolves the configured origin and stays quiet', async () => {
    vi.resetModules();
    vi.stubEnv('WP_LEGACY_BASE', 'https://obshee-delo.ru/ignored/path/');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const imported = await import('./legacyOrigin');

    expect(imported.legacyOrigin).toBe('https://obshee-delo.ru');
    expect(warn).not.toHaveBeenCalled();
  });

  /**
   * CI builds with no WordPress environment at all, so importing this must
   * neither throw nor need a value — the same warn-and-degrade contract
   * `httpClient.ts` established for the REST client.
   */
  it('warns exactly once and disables the fallback when the variable is absent', async () => {
    vi.resetModules();
    vi.stubEnv('WP_LEGACY_BASE', undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const imported = await import('./legacyOrigin');

    expect(imported.legacyOrigin).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[legacy] WP_LEGACY_BASE missing — legacy fallback disabled');
  });

  it('names the variable when the value is garbage', async () => {
    vi.resetModules();
    vi.stubEnv('WP_LEGACY_BASE', 'not a url');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const imported = await import('./legacyOrigin');

    expect(imported.legacyOrigin).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('WP_LEGACY_BASE');
  });
});
