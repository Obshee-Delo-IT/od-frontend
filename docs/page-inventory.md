# Page inventory — what is redesigned, what is passed through, what is on the iframe

**Measured 2026-08-20** against od-dev, and regenerable: `pnpm pages:inventory`. The script (`scripts/page-inventory.mjs`) derives every bucket from the code rather than from a list kept by hand — the page set from `/wp/v2/pages`, the redesigned set from `od_pages_registry()` in `wp/scripts/od-pages.php`, the iframe set from `src/shared/config/legacyEmbedPages.ts` — so a table here can be re-run instead of trusted. It exists because the numbers this file replaces had gone stale by roughly an order of magnitude (§6).

Sibling docs: [`wp-page-passthrough.md`](./wp-page-passthrough.md) is _how_ a page reaches the browser, [`wp-page-redesign.md`](./wp-page-redesign.md) is _how to change one_, [`implementation-plan.md`](./implementation-plan.md) is what is still open. This file is only the census.

## 1. The four buckets

**169 published `wp/v2/pages`** (was 174; the four WooCommerce pages and `/materials/order-materials/` were deleted in WordPress on 2026-08-17).

|                                   | pages | how it renders                                                                                                         |
| --------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------- |
| **Native route** shadows the page |     9 | a route under `src/app/` (or a `src/proxy.ts` 301) owns the URL, so `[...slug]` never sees the WP page at all          |
| **WP page, redesigned**           |    34 | `[...slug]` → `modules/WpPage`, with the body rewritten by `od-pages.php` and drawn by this repo's CSS                 |
| **WP page, passthrough**          |   119 | `[...slug]` → `modules/WpPage`, content exactly as the editor left it — correct URL, correct shell, un-redesigned body |
| **A6 iframe**                     |     7 | on the opt-out list → `modules/Legacy/LegacyEmbed` over `WP_LEGACY_BASE`                                               |

So **153 of 169 pages render natively**, and the iframe is down to seven paths from the twenty it launched with.

## 2. Native routes

Own code, built against Figma. These are not WP pages in the sense above — nine published pages sit _behind_ them and are never served:

| route                                      | file                              | shadowed page                         |
| ------------------------------------------ | --------------------------------- | ------------------------------------- | ----- | ------ | --------------- |
| `/`                                        | `app/page.tsx`                    | `/`                                   |
| `/news/` (+ `?category=`, `/news/page/N/`) | `app/news/page.tsx`               | `/news/`                              |
| `/materials/articles/`                     | `app/materials/articles/page.tsx` | `/materials/articles/`                |
| `/video/`                                  | `app/video/page.tsx`              | `/video/`, and `/video/short/` by 301 |
| `/video/<segment>/` ×4                     | `app/video/[segment]/page.tsx`    | `/video/filmy                         | multy | roliki | famous-people/` |
| `/<id>/` — post or film by `post_format`   | `app/[...slug]/page.tsx`          | —                                     |
| `/profile/<slug>/`                         | `app/profile/[slug]/page.tsx`     | — (a `profile` CPT, not a page)       |

Plus `sitemap.xml`, `robots.txt`, `/health/`, `POST /api/revalidate/` and the internal `/legacy/*`. Workstreams D1 · D2 · D7 and the D3 profile subset are what built these.

## 3. WP pages, redesigned (34)

The `od_pages_registry()` entries — content rewritten by script, styled by the repo. Grouped:

- **Programmes (4)** — `/projects/` · `/healthy-russia/` · `/healthy-youth/` · `/healthy-kids/` (D6e–D6g)
- **Materials (14)** — `/materials/` · `metodichki` · `printed-products` + `books` `zakladki` `booklet` `disk` `autosticker` · `social-reklama` + `plakati` `billboards` `sticker` `led-board-roliki` `audio-roliki-social-reklama` (D8, D6h–D6m)
- **«О нас» (16)** — `/about/` · `/team/` · `about/supervisory` · `nashi_partnery` · `ustav` · `docs` · `udostoverenie` · `activist-stories` · `experts-review` · `smi` · `reviews` + its five category children `letters` `school` `middle` `vuz` `mvd` (D3, D6p–D6w)

The same registry also carries **15 `profile` records** (the coordinator behind `metodichki`, plus the fourteen team and supervisory members) — CPT records, not pages, so they are outside the 169.

## 4. WP pages, passthrough (119)

Right URL, right shell, un-redesigned body. Full list: `pnpm pages:inventory --list passthrough`.

| group                 | pages | notes                                                                                                                                                                        |
| --------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/contacts/<region>/` |    74 | the regional directory. Biggest single group on the site, and the parent `/contacts/` is still on the iframe (D4)                                                            |
| `/get-involved/*`     |    14 | the parent and `/get-involved/join/` are on the iframe                                                                                                                       |
| `/materials/*`        |    11 | the five `/materials/articles/<slug>/` children, `metodichka`, `ppcz-put-geroya`, `ppiz-zdorov-molodez`, `pppuiv-narkosm`, `pppuiv-ted-6`, `plakati/vmeste-sdelaem-luchshe/` |
| legal / donation      |     8 | `/conf_politics/` `/rekvizit/` `/personal-data-usage-terms/` `/donation-service-terms/` `/paypal/` `/sms/` `/thank-you-for-your-donation/` `/sorry-donation-failure/`        |
| «О нас» leftovers     |     2 | `/about/департаменты/` and `/about/написать-письмо-в-общее-дело/` — Cyrillic slugs, in neither the menu nor Figma                                                            |
| misc                  |     6 | `/faq/` (D5) `/sitemap/` `/socialnye-seti/` `/webinar/` `/khabarovskiy/` `/sp/` (hidden, see [`next-steps.md`](./next-steps.md))                                             |
| **test pages**        |     4 | `/test/` `/test-slider/` `/test-page-gutenberg-profile/` `/тестовая-страница/` — published on od-dev and therefore in the sitemap. Unpublish before cutover                  |

Gaps that hit all 119 at once, not any one page (all in [`next-steps.md`](./next-steps.md)): the breadcrumb starts at «Главная» rather than the real parent (D6b), `.wp-block-group h2` lowercases «Россия», icons carry no `aria-hidden`.

## 5. A6 iframe (7)

`src/shared/config/legacyEmbedPages.ts`, each with the reason it is still there:

| path                             | why                                                            | traffic (views / entries) |
| -------------------------------- | -------------------------------------------------------------- | ------------------------: |
| `/contacts/`                     | `[cmsms_*]` residue; D4 is the native replacement, Tier 2      |                  597 / 85 |
| `/get-involved/`                 | same, and the section index carries the old tile grid          |                  586 / 84 |
| `/actual/` (+ its `page/N/`)     | archive listing under the old theme                            |                  281 / 24 |
| `/about/ostavit-otziv/`          | a Contact Form 7 form — nothing on this side renders one (§B6) |                   54 / 10 |
| `/get-involved/join/`            | old-theme markup                                               |                     3 / 3 |
| `/materials/pppuiv-constructor/` | old-theme markup                                               |                     2 / 2 |
| `/добровольчество/`              | old-theme markup                                               |                     7 / 2 |

Underneath the list, the fallback is still automatic: a path WordPress has no page for goes to the iframe too, which is what keeps a URL nobody inventoried from 404ing.

## 6. Traffic, re-measured

Yandex Metrica, 2026-05-14 → 2026-08-13 (91 days), the exports under `~/Documents/od/ya.metrika/`. Rows on the `obshee-delo.ru` host only: **58 921 pageviews · 26 958 entry visits**.

| bucket                         |           pageviews |        entry visits |
| ------------------------------ | ------------------: | ------------------: |
| native route                   | 48 355 (**82.1 %**) | 23 996 (**89.0 %**) |
| WP page, redesigned            |  6 676 (**11.3 %**) |   1 700 (**6.3 %**) |
| WP page, passthrough           |       2 111 (3.6 %) |         976 (3.6 %) |
| **A6 iframe**                  |   **1 530 (2.6 %)** |     **210 (0.8 %)** |
| no page — 404                  |         233 (0.4 %) |          60 (0.2 %) |
| other (truncated rows, `wp-*`) |                  16 |                  16 |

**This corrects the figure the other docs carried.** On 2026-08-13 the fallback was measured at **20.0 % of pageviews and 13.5 % of entries** ([`implementation-notes.md` §7](./implementation-notes.md#7-research--traffic-yandex-metrica-91-days)). Workstreams D3 and D6 did not move traffic — they moved _pages_, and with them 97.0 % of views and 98.9 % of entries onto natively-rendered URLs. The iframe's visible exposure is now **2.6 % of pageviews**, an eighth of what it was, and its SEO exposure **0.8 % of entries**. The old numbers are not wrong for their date; they are simply about a different set of pages, and the launch tiering that was priced off them should be re-read against this table.

The two metrics still rank differently, and still for the reason §7 gives: `/contacts/` and `/get-involved/` are nav destinations (7× views per entry), so the iframe's _look_ costs more than its search exposure implies.

**The 404 bucket is mostly noise** — Yandex adds `&search_source=…` to some referrer URLs, and those rows can't be matched to a path. The real dead URLs in it are few and known: `/contacts/rezan-oblast/` and `/contacts/smolenskaya-oblasti/` (typo'd region slugs that never existed, 8 entries), `/my-account/` and `/shop/` (deleted with the WooCommerce group), `/materials/order-materials/` (deleted with it), `/videos/`.

## 7. What is left, by bucket

- **New native route:** D4 `/contacts/` (Tier 2 — takes `/contacts/` off the iframe; the 74 regional children stay passthrough) · D5 `/faq/` (Tier 4) · D9 volunteer page (scope unconfirmed with Design).
- **Redesign an existing passthrough page:** the two long-form `article` templates are the only unbuilt mocks in D8, and D6's `article` (`778:1766`) + `article-mob` are the same shape. The `/projects/` wide-card variant (598×280) is still unbuilt.
- **Blocked on something else:** `/about/ostavit-otziv/` needs B6 (form handling) before it can come off the iframe.
- **Housekeeping:** unpublish the four test pages; decide what `/about/департаменты/` and `/about/написать-письмо-в-общее-дело/` are for.

## 8. What the census assumes

Worth knowing before quoting a number from it:

- **od-dev, not production.** Production's page set is authoritative for content and should match, but nobody has re-counted it there; the runbook's B5/B8 gates are where that happens.
- **A registry entry means the script _can_ fix the page, not that it has run on production.** Applying workstream D to prod is one `wp eval-file` run — until then, prod's 34 are unredesigned content at redesigned URLs.
- **`SHADOWED` in the script is hand-maintained** — nine URLs, and the one thing in the file not derived. Add a route under `src/app/` and this list needs the same edit, or the page it shadows keeps counting as passthrough.
