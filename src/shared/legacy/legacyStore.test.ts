import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConcurrencyGate, createLegacyStore } from './legacyStore';
import type { LegacyDocument } from './types';

const doc = (html: string): LegacyDocument => ({ html, title: null, description: null });

describe('createLegacyStore (LCP-010)', () => {
  it('serves a stored document back within the window', () => {
    const store = createLegacyStore({ now: () => 1000 });
    store.set('/team/', doc('<p>team</p>'));

    expect(store.get('/team/')?.html).toBe('<p>team</p>');
  });

  it('knows nothing about a path it was never given', () => {
    expect(createLegacyStore().get('/never/')).toBeNull();
  });

  it('drops an entry once its window has elapsed', () => {
    let now = 0;
    const store = createLegacyStore({ ttlMs: 1000, now: () => now });
    store.set('/team/', doc('<p>team</p>'));

    now = 999;
    expect(store.get('/team/')).not.toBeNull();
    now = 1000;
    expect(store.get('/team/')).toBeNull();
    expect(store.size()).toBe(0);
  });

  it('evicts the oldest entry rather than growing past its capacity', () => {
    const store = createLegacyStore({ capacity: 3, now: () => 0 });
    store.set('/a/', doc('a'));
    store.set('/b/', doc('b'));
    store.set('/c/', doc('c'));
    expect(store.size()).toBe(3);

    store.set('/d/', doc('d'));

    expect(store.size()).toBe(3);
    expect(store.get('/a/')).toBeNull();
    expect(store.get('/d/')?.html).toBe('d');
  });

  it('moves a rewritten entry to the back of the eviction order', () => {
    const store = createLegacyStore({ capacity: 2, now: () => 0 });
    store.set('/a/', doc('a'));
    store.set('/b/', doc('b'));
    store.set('/a/', doc('a2'));

    store.set('/c/', doc('c'));

    expect(store.get('/b/')).toBeNull();
    expect(store.get('/a/')?.html).toBe('a2');
  });

  it('hands back a copy, so a caller cannot mutate what the next request sees', () => {
    const store = createLegacyStore({ now: () => 0 });
    store.set('/team/', doc('<p>team</p>'));

    const first = store.get('/team/')!;
    first.html = 'tampered';

    expect(store.get('/team/')?.html).toBe('<p>team</p>');
  });
});

describe('createConcurrencyGate (LCP-010, design D16)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets requests through up to the limit', async () => {
    const gate = createConcurrencyGate({ limit: 2, waitMs: 50 });

    const first = await gate.acquire();
    const second = await gate.acquire();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(gate.active()).toBe(2);
  });

  /**
   * Queueing, not shedding: a crawler sweeping ten pages should get ten slow
   * pages, not six 404s. Only a request that exhausts its wait budget is
   * refused.
   */
  it('makes an over-cap request wait for a slot rather than refusing it', async () => {
    vi.useFakeTimers();
    const gate = createConcurrencyGate({ limit: 1, waitMs: 4000 });

    const held = await gate.acquire();
    let queued: (() => void) | null | undefined;
    const pending = gate.acquire().then((release) => {
      queued = release;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(queued).toBeUndefined();

    held!();
    await pending;

    expect(queued).not.toBeNull();
    expect(gate.active()).toBe(1);
  });

  it('refuses a request that cannot get a slot inside its wait budget', async () => {
    vi.useFakeTimers();
    const gate = createConcurrencyGate({ limit: 1, waitMs: 1000 });

    await gate.acquire();
    const pending = gate.acquire();
    await vi.advanceTimersByTimeAsync(1001);

    await expect(pending).resolves.toBeNull();
    expect(gate.active()).toBe(1);
  });

  it('serves a burst of ten through a cap of four without refusing any', async () => {
    vi.useFakeTimers();
    const gate = createConcurrencyGate({ limit: 4, waitMs: 10_000 });
    const outcomes: Array<(() => void) | null> = [];
    let peak = 0;

    const work = Array.from({ length: 10 }, () =>
      gate.acquire().then((release) => {
        outcomes.push(release);
        peak = Math.max(peak, gate.active());
        // Each request holds its slot for a moment, as a real fetch would.
        setTimeout(() => release?.(), 100);
        return release;
      })
    );

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(work);

    expect(outcomes).toHaveLength(10);
    expect(outcomes.filter((release) => release === null)).toEqual([]);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('ignores a double release, so one caller cannot free another’s slot', async () => {
    const gate = createConcurrencyGate({ limit: 1, waitMs: 10 });

    const release = await gate.acquire();
    release!();
    release!();

    expect(gate.active()).toBe(0);
  });
});
