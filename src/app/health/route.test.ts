import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /health', () => {
  it('answers 200 ok without touching WordPress', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
