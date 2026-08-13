# Legacy-page fallback — old inner content inside the new-design shell

**Status:** decided (2026-06-08). **The catch-all route this design hangs off now exists** — A8 landed `app/[...slug]/page.tsx` on 2026-08-13 to serve legacy `/<id>` post URLs, and it `notFound()`s on every non-numeric path. **That `notFound()` branch is exactly the seam this document fills.** Still to build: the proxy route, the `LegacyEmbed` component, the denylist, and the frozen copy itself.
**Goal:** ship the new-design Next.js site to production **before** every page is redesigned, and serve the not-yet-redesigned pages as their **old inner content embedded inside the new header/footer**, proxied from a frozen copy of the old site. Migrate page-by-page; each redesigned page is published as it's finished and automatically replaces its embedded fallback. (The aim is **design** migration — *not* a Gutenberg/content migration; the cmsms-vs-Gutenberg detail below only dictates *how* we embed.)

## Decision

- **Mechanism: iframe via a same-origin proxy route.** The catch-all page renders the new `<Header>`, an `<iframe>`, and the new `<Footer>`; the iframe points at *our own* Next route that server-fetches the old page from the frozen copy and returns it chromeless. Same-origin ⇒ no `X-Frame-Options`/CORS friction, unrestricted height-sync and link handling.
- **Source: a frozen dedicated copy** of the old (welfare + cmsms) site — stable content for the transition. We *can* make small changes there (enable REST, add a chromeless template).
- **Not chosen: bare SSR content-injection** — the old content is theme-CSS- and theme-JS-coupled (see §2/§2b), so injecting raw HTML into our React shell would lose styling and break interactive cmsms widgets. The iframe isolates CSS/JS cleanly. SEO is the accepted trade (§4).

## 1. Why a fallback at all

A probe of od-dev found **174 published `wp/v2/pages`** (re-confirmed 2026-08-13) — regional pages (~40), programmes (`/projects`, `/healthy-russia`, …), materials (`/printed-products`, `/social-reklama`, …), legal (`/conf_politics`, `/rekvizit`, …), team, plus a long tail. The Figma redesign covers a fraction (D1–D9). Redesigning all 174 before launch isn't realistic, and "build everything, publish once at the end" is too slow — so we publish now and let un-redesigned pages fall back to their embedded old content, replacing them one at a time.

**How much traffic this actually carries — measured, not assumed.** 91 days of Yandex Metrica put every page that would sit behind the fallback at **13.5 % of entry visits**; the redesigned routes cover 85.1 % and the legacy redirects another 1.5 %. That reframes the SEO trade in §4 from "risky" to "priced": it is 13.5 % of entries on pages we are actively replacing. It also says *which* of them shouldn't wait — `/materials/plakati/` alone is the #6 entry page on the whole site and deserves a native route before prod, not an iframe. The tiering is in [`implementation-plan.md` → Launch priority](./implementation-plan.md#launch-priority).

**But measure the *visible* exposure by pageviews, and it is half again as large: 20.0 %.** One pageview in five would land in an iframe. Entry visits are the right metric for §4's SEO trade, and the wrong one for how much of the site *looks* half-migrated — those are different questions with different answers. The most-viewed page behind the fallback is `/about/` (**1 036 views against 230 entries**), and the pattern repeats: `/projects/` 794/85, `/materials/` 939/107, `/get-involved/` 586/84. None of them are search landings; all of them are things people click from the nav. Two consequences for this document: the chromeless template's fidelity matters more than the entry share implies (§3), and the §5 validation set should be picked by views — `/about/`, `/projects/`, `/materials/`, `/get-involved/`, `/team/` — since those are what visitors will actually see.

## 2. What the old content actually is (why iframe, not injection)

The old design's look is produced by the theme, not the page body:

- **Prod (`obshee-delo.ru`) and stage (`stage.od.webtm.ru`) render through the `welfare` theme with ~30 combined CSS bundles + ~55 inline scripts per page.** `clearfy-pro` concatenates the CSS site-wide, so "just the CSS this page needs" can't be cleanly isolated.
- **REST is disabled on prod and stage** (`/wp-json/…` redirects to home — a clearfy feature). Only **od-dev** truly serves REST.
- **The stored content is CMSMasters page-builder shortcodes, not Gutenberg.** Read via WP-CLI on od-stage, the same page IDs differ sharply between environments:

  | page | od-dev (`content.rendered`) | od-stage / prod (raw `post_content`) |
  |---|---|---|
  | projects #59466 | 28 `wp-block-*`, 0 cmsms | **0 blocks, 34 `[cmsms_*]` shortcodes** |
  | team #59436 | 84 blocks | **0 blocks, 90 cmsms** |
  | healthy-russia #60050 | 73 blocks | **0 blocks, 69 cmsms** |
  | printed-products #57271 | 40 blocks | **0 blocks, 48 cmsms** |

  The legacy body is `[cmsms_row]`/`[cmsms_column]`/`[cmsms_text]`/`[cmsms_profiles]`/`[cmsms_toggle]`/… — it only renders correctly with the cmsms plugin **and** welfare CSS/JS active. (od-dev is a *migrated-to-Gutenberg* copy — not representative of the live design.)

**The triangle (pick two): faithful old look · new header/footer · clean-SSR/SEO.** Embedding the old content faithfully *inside* the new shell sacrifices SSR/SEO — which is why the iframe (isolated, keeps theme CSS/JS) is the right tool, with SEO handled per §4.

## 3. Architecture (chosen)

```
┌─ Next.js (new design, prod) ───────────────────────────────┐
│  app/[...slug]/page.tsx        ← catch-all, lowest priority │
│    ✅ /<id>  → NewsArticle | FilmPage   (A8, built)         │
│    ⬜ else   → <Header/>                (A6, to build)      │
│                <LegacyEmbed src="/legacy/<path>"/> iframe   │
│                <Footer/>                                    │
│                                                             │
│  app/legacy/[...slug]/route.ts ← same-origin proxy  ⬜       │
│    fetch  https://<frozen-copy>/<path>?embed=1              │
│    → return chromeless HTML (theme CSS/JS kept)             │
└──────────────────────────────┬──────────────────────────────┘
                                │ server-side fetch
                    ┌───────────▼───────────┐
                    │ frozen copy (welfare + │  ⬜ not stood up
                    │ cmsms), chromeless     │
                    │ template + REST on     │
                    └────────────────────────┘
```

**Note the catch-all is now shared.** It was written for A8 (serving legacy `/<id>` post URLs) and already carries `revalidate = 3600`, `dynamicParams`, and a `generateStaticParams` that seeds 20 films + 20 posts. A6 adds a branch, not a route — but it also means the two features share a cache policy and a `generateMetadata`, so changes to either need to keep the numeric path working.

- **Frozen copy (small WP-side changes, allowed):**
  - **Chromeless render mode** — a page template `embed` (or a `?embed=1` switch) that outputs `wp_head()` + `the_content()` + `wp_footer()` with **no** header/footer/sidebar. ~20 lines; this lets WP define the exact "inner content" boundary instead of us guessing a DOM selector. It still enqueues the welfare/cmsms CSS + JS, so the content looks and behaves like the old site.
  - **REST on** — optional but cheap; useful for pulling each page's `<title>`/meta for our `generateMetadata`, and for listing/denylisting.
- **Next proxy route `app/legacy/[...slug]/route.ts`:** server-fetches the chromeless URL, rewrites asset URLs to absolute (`//frozen-copy/...` for CSS/JS/images), rewrites in-content links from the copy origin → **relative** (so a link to `/team` stays in the new site and re-falls-back or hits the redesigned route), injects a small height-`postMessage` script + `<base target="_parent">` if not already in the template, and returns the HTML. Served from our origin ⇒ the iframe is **same-origin**.
- **Catch-all `app/[...slug]/page.tsx`:** for a non-numeric path, renders `<Header/>` + `<LegacyEmbed/>` + `<Footer/>` (today it `notFound()`s there). `<LegacyEmbed>` is a small client component: an `<iframe src="/legacy/…">` that listens for the height message and sets its own height (same-origin, so no postMessage origin limits). Explicit redesigned routes (`/news`, `/video`, the next Figma pages) **always win** over the catch-all, so finishing a page automatically retires its fallback. Two consequences of A8 landing first: the site now runs with **`trailingSlash: true`**, so proxied paths arrive slashed and the rewriter must not double up; and **`src/proxy.ts`** holds the legacy redirects, which run **before** the catch-all — check it first when debugging a "page falls through to the fallback" report. Its matcher covers `/video/*`, `/news/*`, `/category/*` and `/page/*`, and the `/category/*` rule is **exhaustive** (unmapped archives → `/news/`), so no `/category/` URL ever reaches the fallback. The redirects are in the proxy, not `next.config.ts` `redirects()`, on purpose — a config table would shadow it.

## 4. Caveats & mitigations

| Concern | Handling |
|---|---|
| **SEO** — iframe content isn't part of the parent page's DOM | Accepted for transitional pages (they're being replaced). Keep the legacy URLs indexable on the copy/legacy host with `rel=canonical` during the window; redesigned pages get full SSR SEO immediately. Revisit if a high-value page lingers. |
| In-content links point at the copy origin | Proxy rewrites same-origin absolute links → relative so navigation stays in the new shell. |
| iframe height / no inner scrollbar | Height-`postMessage` from the chromeless template (on load + `ResizeObserver`/mutation), parent sets iframe height. Same-origin ⇒ trivial. |
| `X-Frame-Options` / CORS on the copy | Avoided entirely — the iframe targets *our* `/legacy` route, not the copy origin; the fetch is server-to-server. |
| Interactive cmsms widgets (toggles, sliders) | Work, because the chromeless template keeps the theme/cmsms JS. (This is the main reason to iframe rather than inject.) |
| Routing precedence | App Router static/dynamic segments beat `[...slug]`; reserve the catch-all as the final fallback. Verify no built route is shadowed. |
| Retired pages | A denylist in the catch-all → `notFound()` (our 404) instead of embedding. |
| Frozen-copy drift / uptime | It's a dedicated, frozen snapshot; the new site's availability depends on it only for un-redesigned pages. Cache proxied responses (ISR/`revalidate`) to cut load and add resilience. |

## 5. Suggested first slice (prototype)

Step 3 got cheaper — the catch-all is already there from A8.

1. Stand up / point at the **frozen copy**; add the chromeless `embed` template (+ enable REST).
2. `app/legacy/[...slug]/route.ts` — proxy + asset/link rewrite + height script.
3. `LegacyEmbed` client component (auto-height iframe), and swap the catch-all's `notFound()` branch for `<Header/>` + `<LegacyEmbed/>` + `<Footer/>` behind a denylist. **Keep the numeric-id branch first** — it carries 46 % of site entries.
4. Validate against the 5 pages **visitors will actually see most** — picked by pageviews, not entries: `/about/` (1 036), `/materials/` (939), `/projects/` (794), `/get-involved/` (586), `/team/` (326). Confirm height-sync, link navigation, and that `/news` & `/video` still take precedence. Add a region page and `/rekvizit/` as shape checks (cmsms columns, plain text).
5. Extend the existing `generateMetadata` to pull title/description from the copy's REST for embedded pages (it currently returns `{}` for anything non-numeric).

## 6. Open questions for the team

- **Frozen copy host:** where does it live and on what URL (so `WP_LEGACY_BASE` can be set)? Can we add the chromeless template + enable REST there? **This is the blocking one** — nothing else in §5 can start without it.
- **Hosting topology:** Next is the apex origin in prod (A2: Beget VPS + Coolify). Confirm the frozen copy sits on a separate host reachable **server-side** by the proxy route, and that outbound HTTPS from the container to it is allowed.
- **Retired pages:** which legacy slugs should 404 rather than embed?
- ~~**SEO window:** any high-value legacy page where iframe-SEO is unacceptable?~~ — **answered by the Metrica read.** Four pages clear the bar and should get native routes instead of an iframe: `/materials/plakati/` (501 entries, the #6 entry page on the site), `/materials/zakladki/` (150), `/contacts/` (545) and the `/profile/*` detail template (565). They're Tier 2 in the plan. Everything else behind the fallback is under 0.2 % of entries each, where iframe SEO is an acceptable trade.
- **Legacy URL shapes are already handled elsewhere.** A8 owns the `/<id>` posts, the `/video/*` catalogue, the whole `/category/*` family and the `/page/N/` shapes. Don't re-solve them here; check `src/shared/config/legacyRedirects.ts` first.
