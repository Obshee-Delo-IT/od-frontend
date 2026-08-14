import { expect, test, type Page } from '@playwright/test';
import { loadFixture } from '../src/shared/legacy/__fixtures__/load';
import { transformLegacyHtml } from '../src/shared/legacy/transformLegacyHtml';

/**
 * The injected runtime, verified in a real browser (V8, V20–V28).
 *
 * These are **required**, not optional. GATE 1's over-engineering assessment
 * found that five of its eight review rounds went on the forty lines of
 * navigation logic in `legacyRuntime.ts`, and that each of those findings is a
 * one-line assertion here. Prose review of that code has reached its limit; the
 * mutation table in `verification-plan.md` names what each of these must catch.
 *
 * Hermetic by construction: every request is fulfilled by the test, including
 * the documents themselves, so nothing here depends on a dev server, on the
 * network, or on what the live legacy site happens to contain today. The two
 * origins below are fictional on purpose — a real one would let a genuine leak
 * pass as a successful load.
 */

const SITE = 'https://od.e2e.test';
const LEGACY = 'https://legacy.e2e.test';
const PATH = '/team/';

/**
 * The captured pages reference most of their assets absolutely, at the real
 * origin, so a fixture-driven test has to be transformed against that origin
 * for its stylesheets and images to be recognisable as legacy traffic. Nothing
 * is ever fetched from it — every request is fulfilled by the route handler
 * below.
 */
const CAPTURE_ORIGIN = 'https://obshee-delo.ru';
const LEGACY_ORIGINS = [LEGACY, CAPTURE_ORIGIN];

/**
 * A legacy page written the way the theme writes them, carrying one link of
 * every shape in the classification matrix (origin × path kind × written form ×
 * click kind). It goes through the real transform, so what the browser sees is
 * exactly what `/legacy/*` would serve.
 */
const MATRIX_PAGE = `<!doctype html>
<html lang="ru"><head><title>Матрица ссылок</title></head>
<body>
<header id="header"><a href="/">chrome link</a></header>
<section id="middle">
  <a id="rooted" href="/contacts/">rooted</a>
  <a id="absolute" href="${LEGACY}/about/">absolute</a>
  <a id="relative" href="../about/">document relative</a>
  <a id="query" href="?tab=1">query only</a>
  <a id="fragment" href="#target">fragment</a>
  <a id="download" href="/wp-content/uploads/2019/11/poster.jpg">download</a>
  <a id="download-self" href="/wp-content/uploads/2019/11/poster.jpg" target="_self">download, _self</a>
  <a id="third-party" href="https://vk.example/obshedelo">third party</a>
  <a id="js-scheme" href="javascript:window.jsSchemeRan = true">javascript scheme</a>
  <a id="blank-relative" href="../about/" target="_blank">relative, _blank</a>
  <a id="mailto" href="mailto:info@example.org">mail</a>
  <form id="search" action="${LEGACY}/"><input name="s" id="search-input"><button id="search-submit" type="submit">искать</button></form>
  <div style="height:1200px">spacer</div>
  <a id="bare-hash" href="#">bare hash</a>
  <a id="missing-fragment" href="#nowhere">missing target</a>
  <div style="height:2000px">spacer</div>
  <h2 id="target">Цель</h2>
  <div style="height:1500px">spacer</div>
</section>
<footer id="footer">chrome</footer>
</body></html>`;

const HOST_PAGE = `<!doctype html>
<html lang="ru"><head><title>Оболочка сайта</title></head>
<body style="margin:0">
<h1 id="site-shell">SITE SHELL</h1>
<iframe id="frame" title="Устаревшая страница сайта" src="/legacy/team/"
        style="display:block;width:100%;border:0;height:60vh"></iframe>
<script>
  // Mirrors LegacyEmbed's listener. The component itself is unit-tested
  // (V14, V17); this harness exists to exercise the *frame* side.
  window.__heights = [];
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) { return; }
    var frame = document.getElementById('frame');
    if (event.source !== frame.contentWindow) { return; }
    var data = event.data;
    if (!data || data.type !== 'od:legacy-height') { return; }
    var height = Number(data.height);
    if (!Number.isFinite(height) || height <= 0 || height > 50000) { return; }
    window.__heights.push(height);
    frame.style.height = height + 'px';
  });
</script>
</body></html>`;

const transform = (html: string, path = PATH, origin = LEGACY): string =>
  transformLegacyHtml(html, { origin, path, siteOrigin: SITE }).html;

/** The same document with our injected script deleted — "scripting unavailable". */
const withoutRuntime = (html: string): string => html.replace(/<script data-od-legacy-runtime>[\s\S]*?<\/script>/, '');

interface Harness {
  /** Every URL requested, with the frame that asked for it. */
  requests: Array<{ url: string; fromFrame: boolean }>;
}

const install = async (page: Page, legacyDocument: string): Promise<Harness> => {
  const harness: Harness = { requests: [] };

  page.on('request', (request) => {
    harness.requests.push({ url: request.url(), fromFrame: request.frame() !== page.mainFrame() });
  });

  // Routed on the **context**, not the page: a `target="_blank"` click opens a
  // new page that inherits context routes but not page routes, and an
  // unrouted popup lands on `chrome-error://chromewebdata/` — which would let
  // "the popup did not go to the legacy origin" pass for the wrong reason.
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const html = (body: string) => route.fulfill({ contentType: 'text/html; charset=utf-8', body });

    if (url.origin === SITE && url.pathname === '/host.html') {
      return html(HOST_PAGE);
    }
    if (url.origin === SITE && url.pathname === '/legacy/team/') {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        headers: { 'x-robots-tag': 'noindex', 'content-security-policy': "frame-ancestors 'self'" },
        body: legacyDocument,
      });
    }
    if (url.origin === SITE) {
      return html(`<title>site</title><p id="site-page">${url.pathname}${url.search}</p>`);
    }
    if (LEGACY_ORIGINS.includes(url.origin)) {
      // Anything answered from here is a leak unless the test expects it.
      return html(`<title>legacy</title><p id="legacy-page">${url.pathname}</p>`);
    }
    return html(`<title>elsewhere</title><p id="third-party-page">${url.host}</p>`);
  });

  return harness;
};

const openHost = async (page: Page, legacyDocument: string): Promise<Harness> => {
  const harness = await install(page, legacyDocument);
  await page.goto(`${SITE}/host.html`);
  await page.locator('#frame').waitFor();
  return harness;
};

/** Wait until the height sync has actually resized the frame. */
const awaitHeightSync = async (page: Page): Promise<void> => {
  await expect.poll(async () => page.locator('#frame').evaluate((el) => el.clientHeight)).toBeGreaterThan(3000);
};

const frame = (page: Page) => page.frameLocator('#frame');

test.describe('injected runtime — height (LCP-008, V8)', () => {
  test('reports a height and the parent grows to it', async ({ page }) => {
    await openHost(page, transform(MATRIX_PAGE));

    await expect.poll(async () => page.locator('#frame').evaluate((el) => el.clientHeight)).toBeGreaterThan(3000);

    const heights: number[] = await page.evaluate(() => (window as unknown as { __heights: number[] }).__heights);
    expect(heights.length).toBeGreaterThan(0);
    expect(heights.at(-1)).toBeGreaterThan(3000);
  });

  test('suppresses the inner scrollbar only once it has reported', async ({ page }) => {
    await openHost(page, transform(MATRIX_PAGE));
    await expect.poll(async () => page.locator('#frame').evaluate((el) => el.clientHeight)).toBeGreaterThan(3000);

    const overflow = await frame(page)
      .locator('body')
      .evaluate(() => document.documentElement.style.overflowY);
    expect(overflow).toBe('hidden');
  });

  /**
   * The failure mode that matters: if the reporter never runs, the frame stays
   * at its starting height, so the document must still scroll internally or the
   * page is unreachable. This is why suppression is not static CSS.
   */
  test('leaves the document scrollable when the runtime never runs', async ({ page }) => {
    await openHost(page, withoutRuntime(transform(MATRIX_PAGE)));

    const frameHeight = await page.locator('#frame').evaluate((el) => el.clientHeight);
    expect(frameHeight).toBeLessThan(1000);

    const scrollable = await frame(page)
      .locator('body')
      .evaluate(() => {
        const root = document.documentElement;
        return {
          overflow: getComputedStyle(root).overflowY,
          scrollHeight: root.scrollHeight,
          clientHeight: root.clientHeight,
        };
      });

    expect(scrollable.overflow).not.toBe('hidden');
    expect(scrollable.scrollHeight).toBeGreaterThan(scrollable.clientHeight);
  });
});

test.describe('injected runtime — navigation (LCP-011, V20–V26)', () => {
  test.beforeEach(async ({ page }) => {
    await openHost(page, transform(MATRIX_PAGE));
  });

  test('V20 a page link navigates the top-level window', async ({ page }) => {
    await frame(page).locator('#rooted').click();

    await expect(page).toHaveURL(`${SITE}/contacts/`);
    await expect(page.locator('#site-page')).toHaveText('/contacts/');
    await expect(page.locator('#frame')).toHaveCount(0);
  });

  test('V20 a document-relative link navigates the top window to the new site', async ({ page }) => {
    await frame(page).locator('#relative').click();
    await expect(page).toHaveURL(`${SITE}/about/`);
  });

  test('V20 a query-only link navigates the top window to the new site', async ({ page }) => {
    await frame(page).locator('#query').click();
    await expect(page).toHaveURL(`${SITE}/team/?tab=1`);
  });

  test('V20 an already-absolute legacy link navigates the top window to the new site', async ({ page }) => {
    await frame(page).locator('#absolute').click();
    await expect(page).toHaveURL(`${SITE}/about/`);
  });

  /**
   * Once the height sync has run the frame is as tall as its content, so the
   * document inside it has nothing left to scroll — `scrollIntoView` moves the
   * *parent*, which is what the visitor sees. Asserting the frame's own
   * `scrollY` here would be asserting an implementation detail that the height
   * contract deliberately removes.
   */
  test('V21 an in-page anchor scrolls to the target and navigates nothing', async ({ page }) => {
    const before = page.url();

    await frame(page).locator('#fragment').click();

    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    expect(page.url()).toBe(before);
    await expect(page.locator('#frame')).toHaveCount(1);
    await expect(frame(page).locator('#target')).toBeInViewport();
  });

  /**
   * Both of these links sit far enough down the page that reaching them puts
   * the window at a non-zero scroll offset — otherwise "it did not jump to the
   * top" would be satisfied by having never left the top. The offset is read
   * *after* `scrollIntoViewIfNeeded`, because Playwright's own click scrolls
   * the element into view and would otherwise be measured as the movement.
   */
  test('V21 a fragment naming nothing moves nowhere', async ({ page }) => {
    const url = page.url();
    await awaitHeightSync(page);
    const link = frame(page).locator('#missing-fragment');
    await link.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(300);

    await link.click();

    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  /**
   * `href="#"` on this theme is a JS hook — both occurrences in the `/faq/`
   * capture are accordion toggles — so it must not navigate *and* must not jerk
   * the page to the top.
   */
  test('V21 the bare hash idiom neither navigates nor scrolls', async ({ page }) => {
    const url = page.url();
    await awaitHeightSync(page);
    const link = frame(page).locator('#bare-hash');
    await link.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(300);

    await link.click();

    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('V22 a download opens elsewhere and leaves the page in place', async ({ page }) => {
    const before = page.url();
    const [popup] = await Promise.all([page.context().waitForEvent('page'), frame(page).locator('#download').click()]);

    expect(new URL(popup.url()).pathname).toBe('/wp-content/uploads/2019/11/poster.jpg');
    expect(page.url()).toBe(before);
    await expect(page.locator('#frame')).toHaveCount(1);
    await expect(frame(page).locator('#target')).toBeAttached();
  });

  test('V22 an author’s target="_self" on a download is not consent to replace the page', async ({ page }) => {
    const before = page.url();
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      frame(page).locator('#download-self').click(),
    ]);

    expect(popup.url()).toContain('/wp-content/');
    expect(page.url()).toBe(before);
    await expect(frame(page).locator('#target')).toBeAttached();
  });

  test('V23 a third-party link opens outside the frame', async ({ page }) => {
    const before = page.url();
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      frame(page).locator('#third-party').click(),
    ]);

    expect(new URL(popup.url()).host).toBe('vk.example');
    expect(page.url()).toBe(before);
  });

  test('V24 a modified click is left to the browser, with the destination corrected', async ({ page }) => {
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      frame(page)
        .locator('#relative')
        .click({ modifiers: ['ControlOrMeta'] }),
    ]);
    // A modified click opens a *background* tab, which reports `about:blank`
    // until it commits — `waitForLoadState` resolves immediately on that and
    // would let the assertion read a URL the tab never had.
    await expect.poll(() => popup.url()).not.toBe('about:blank');

    expect(new URL(popup.url()).origin).toBe(SITE);
    expect(new URL(popup.url()).origin).not.toBe(LEGACY);
  });

  test('V24 an explicit target opens the new site, never the legacy origin', async ({ page }) => {
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      frame(page).locator('#blank-relative').click(),
    ]);

    expect(popup.url()).toBe(`${SITE}/about/`);
  });

  test('V25 a javascript: link is prevented', async ({ page }) => {
    const before = page.url();

    await frame(page).locator('#js-scheme').click();

    expect(page.url()).toBe(before);
    const ran = await frame(page)
      .locator('body')
      .evaluate(() => (window as unknown as { jsSchemeRan?: boolean }).jsSchemeRan ?? false);
    expect(ran).toBe(false);
  });

  test('V26 a form cannot submit, by button or by Enter', async ({ page }) => {
    const before = page.url();

    await frame(page).locator('#search-input').fill('водка');
    await frame(page).locator('#search-submit').click();
    expect(page.url()).toBe(before);
    await expect(frame(page).locator('#search')).toBeAttached();

    await frame(page).locator('#search-input').press('Enter');
    expect(page.url()).toBe(before);
    await expect(frame(page).locator('#search')).toBeAttached();
  });

  test('a mailto link is left to the browser', async ({ page }) => {
    const href = await frame(page).locator('#mailto').getAttribute('href');
    expect(href).toBe('mailto:info@example.org');
  });
});

test.describe('the invariants prose review kept missing (V27, V28)', () => {
  /**
   * The no-JS floor. With the injected script gone, the rewrite alone has to
   * keep every page link off the legacy origin — this is what refuted the
   * rewrite-only-rooted-hrefs design in round 6.
   */
  test('V27 no anchor reaches a legacy page when the runtime never runs', async ({ page }) => {
    await openHost(page, withoutRuntime(transform(MATRIX_PAGE)));

    const leaking = await frame(page)
      .locator('body')
      .evaluate((_body, legacy: string) => {
        const here = document.baseURI.split('#')[0];
        return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
          .map((anchor) => anchor.href)
          .filter((href) => href.startsWith(legacy))
          .filter((href) => !/\/wp-content\//.test(href))
          .filter((href) => href.split('#')[0] !== here);
      }, LEGACY);

    expect(leaking).toEqual([]);
  });

  test('V27 clicking a page link without the runtime still lands on the new site', async ({ page }) => {
    await openHost(page, withoutRuntime(transform(MATRIX_PAGE)));

    await frame(page).locator('#rooted').click();

    // The frame navigates rather than the top window — the accepted residual
    // cost of scripting being unavailable — but never to the legacy origin.
    await expect(frame(page).locator('#site-page')).toHaveText('/contacts/');
  });

  /**
   * Design invariant 7, on a real page: every asset the legacy document asks
   * for must resolve against the legacy origin through the injected `<base>`.
   * A single request from the frame to our own origin means an asset reference
   * escaped, and on the real server it would 404 and strip the page's styling.
   */
  test('V28 the framed document requests nothing from the site origin', async ({ page }) => {
    const harness = await openHost(page, transform(loadFixture('team'), '/team/', CAPTURE_ORIGIN));
    await page.waitForTimeout(1500);

    const fromFrameToSite = harness.requests
      .filter((request) => request.fromFrame)
      .filter((request) => request.url.startsWith(SITE))
      .filter((request) => request.url !== `${SITE}/legacy/team/`);

    expect(fromFrameToSite.map((request) => request.url)).toEqual([]);
  });

  test('V28 the real page still asks the legacy origin for its assets', async ({ page }) => {
    const harness = await openHost(page, transform(loadFixture('team'), '/team/', CAPTURE_ORIGIN));
    await page.waitForTimeout(1500);

    const toLegacy = harness.requests.filter((request) => request.url.startsWith(CAPTURE_ORIGIN));
    expect(toLegacy.length).toBeGreaterThan(10);
  });
});
