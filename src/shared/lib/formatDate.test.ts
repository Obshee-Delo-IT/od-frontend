import { describe, expect, it } from 'vitest';
import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formats a WordPress date as DD.MM.YYYY, zero-padded', () => {
    expect(formatDate('2026-08-04T10:00:00')).toBe('04.08.2026');
    expect(formatDate('2026-12-31T09:15:00')).toBe('31.12.2026');
  });

  it('is empty for a missing or unparseable date, never today', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });
});
