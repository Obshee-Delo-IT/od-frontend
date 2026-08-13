import { describe, expect, it } from 'vitest';
import { siteUrl } from '@/shared/config/site';
import robots from './robots';

const rule = () => {
  const { rules } = robots();
  return Array.isArray(rules) ? rules[0] : rules;
};

const disallowed = () => {
  const { disallow } = rule();
  return Array.isArray(disallow) ? disallow : [disallow ?? ''];
};

describe('robots', () => {
  it('lets every crawler in', () => {
    expect(rule().userAgent).toBe('*');
    expect(rule().allow).toBe('/');
  });

  it('advertises the sitemap slashless — the slashed twin is a 308', () => {
    expect(robots().sitemap).toBe(`${siteUrl}/sitemap.xml`);
  });

  it('blocks the health probe at the URL it actually answers on', () => {
    expect(disallowed()).toContain('/health/');
  });

  it('blocks the unbounded search space', () => {
    expect(disallowed()).toContain('/search');
    expect(disallowed()).toContain('/*?s=');
  });

  it('leaves pagination and Next assets crawlable', () => {
    disallowed().forEach((path) => {
      expect(path).not.toBe('/*?');
      expect(path).not.toContain('page=');
      expect(path).not.toContain('_next');
    });
  });
});
