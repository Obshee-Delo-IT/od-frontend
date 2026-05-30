# Implementation plan

A high-level roadmap from the current state (one route, news-detail only) to the design covered in [`design-system.md`](./design-system.md) and [`page-mocks.md`](./page-mocks.md).

This is upper-level only — tasks worth tracking in a real backlog, not a step-by-step diary. Each workstream is one chunk of work that could plausibly be owned by one person/PR.

---

## Findings from the current live site (`obshee-delo.ru`)

The redesign is replacing an existing site. Key facts harvested from a live read on 2026-05-29 — used throughout the plan below to firm up assumptions:

- **Scale.** Sitemap index reports ~500–1000+ URLs across 11 child sitemaps. Confirms the Materials section is real volume, not a Figma exaggeration.
- **No on-site search.** Header search icon on the redesign would be a **new** feature. Out of scope unless Design confirms.
- **No language switcher.** Russian-only is permanent — no `next-intl`/`i18next` needed.
- **No embedded forms anywhere.** Contact, participation, "leave a review", and "suggest an idea" all currently route via email or external services (`reformal.ru`). Any forms in the redesign (`contact-page`, the participation scratch) are **net-new**, not migrations. Workstream B6 is a genuinely new build.
- **Analytics.** Live privacy policy names **Yandex Metrica + Google Analytics**, but **GA is no longer usable** under current Russian regulations. Redesign drops GA — **Yandex Metrica only**. The ported privacy-policy copy needs to be amended to remove the GA reference (the live page is stale on this).
- **Foreign-service caveat — narrower than first framed.** The site itself only serves **public content**, so hosting, CDN, image optimisation, and asset delivery can sit abroad without 152-FZ data-localisation concerns (Vercel / Cloudflare / GitHub-hosted assets are all fine). The restrictions bite specifically at **PII entry points and PII-touching telemetry**: analytics (→ Yandex Metrica only), captcha on forms (→ Yandex SmartCaptcha, not reCAPTCHA), and where form data lands. **Form submissions are already settled**: every form posts into the existing RU-hosted WordPress backend (see B6). Error tracking is **deferred** for this iteration (see A4).
- **Legal posture.** Site is a registered СМИ (mass media outlet) under Roskomnadzor (cert Эл № ФC77-72346, 14 Feb 2018), with "12+" content rating. Redesign must preserve the registration cert display and rating badge in the footer. Privacy policy is under **152-FZ** only; **no GDPR** notice. Legal entity: «Общероссийская общественная организация поддержки президентских инициатив в области здоровьесбережения нации "Общее дело"», ОГРН 1127799010624.
- **Content taxonomy is firmer than Figma suggests.**
  - **Films (`/video/`)** split into 5 sub-categories: full films, animated, clips, short films, "famous people". Matches Figma `video-filter` intent.
  - **Materials (`/materials/`)** split into ~14 sub-pages: methodical guides, printed (DVDs, books, bookmarks, flyers, car stickers), social advertising (posters, billboards, stickers, LED clips, audio clips), articles. Matches Figma section.
  - **About (`/about/`)** has 11 sub-pages on the live site (organisation, team, activist stories, media coverage, partners, certificate, charter, expert reviews, thank-you letters, documents, statistics). More than Figma currently mocks — confirm with Design which subset is in scope.
  - **Section label drift:** live site calls the section **«ПРОГРАММЫ»** (`/projects/`), Figma section is **«проекты»**. Pick one for the redesign and apply consistently.
- **External / sibling properties — likely out of scope, but worth confirming.** These currently live on separate domains and the redesign will need links into them, not implementations of them:
  - **`общее-дело.рф`** (punycode `xn----9sbkcac6brh7h.xn--p1ai`) — alt domain serving some of the same content; already allowlisted in `next.config.ts` `images.remotePatterns`.
  - **`od-pro.ru`** — «ОБЩЕЕДЕЛО-ПРО», a separate property linked from the main nav.
  - **`помоги.общее-дело.рф`** — donation site, "Помоги" CTA from the top of the live site.
  - **`статы.общее-дело.рф`** — statistics dashboard linked from About.
  - **`reformal.ru/od1`** — third-party "suggest an idea" form.
- **Pages the live site has that Figma doesn't currently mock** — worth raising with Design: `/about/smi/` (media coverage), `/about/nashi_partnery/` (partners), `/about/experts-review/`, `/about/reviews/`, `/about/ostavit-otziv/` (submit a review), `/sp/` (charity action), `/sitemap/` (human-readable sitemap page).

---

## Reading the status legend

- `[ ]` not started
- `[~]` partially done / blocked
- `[x]` done

---

## Workstream A — Foundations

Resolve the things that will bite every later workstream.

- _Note (not an action task): designer-confirmation list_ — button `cornerRadius: 5` vs `radius="full"`, role of `1_main_black` and `4_line_gray`, fate of orphan Inter type styles. Brand red token mismatch was checked visually and is **not** a real drift; the rendered CTA matches the design. Keep these as questions to raise opportunistically with Design, not blockers. See [`design-system.md` §4.3](./design-system.md#43-open-questions--known-drift).
- [ ] **A2. Decide hosting / deploy story.** Single VPS via `docker-compose-prod.yaml`? Kubernetes? Vercel? **Foreign hosting is acceptable** — the site only serves public content, so 152-FZ data-localisation doesn't apply at the hosting layer (it applies only to where form submissions land — see B6). This decision affects ISR survival (per-replica vs shared cache), where build runs, secrets management, and the shape of CI/CD.
- [x] **A3. CI pipeline.** Deploy is wired via the Coolify GitHub app (triggers on push), so CI/CD's deploy half is already solved. `.github/workflows/ci.yml` runs `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` on `pull_request` (any base) **and** on `push` to `main`. Concurrency cancels in-flight PR runs (latest commit wins) but lets every main-branch commit complete (so each deploy has its own pass/fail). pnpm pinned to 11.3.0 matching the Dockerfile; Node read from `.nvmrc`; JavaScript actions opted into the Node 24 runtime via `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` ahead of the 2026-06-16 default flip. The build runs **without** WP secrets in CI — `httpClient` and `next.config.ts` detect missing/empty `WP_BASE`/`WP_USER`/`WP_PASSWORD` and substitute a stub fetch that returns `[]`, so compilation + RSC boundaries are still validated end-to-end. Real-data builds remain Coolify's job, where the secrets live. The `lint · type-check · test · build` check is wired as a required status check on `main` via a Rulesets entry, so Coolify never auto-deploys a red commit.
- [ ] **A4. Observability baseline.** Analytics: **Yandex Metrica only** — Google Analytics is excluded under current Russian regulations. Wire Metrica into `app/layout.tsx`, gated behind a 152-FZ-compliant consent banner (see F6). **Error tracking is deferred** for this iteration — rely on Next.js standalone-server stdout/stderr captured by the hosting platform until traffic justifies a dedicated tool. Revisit once the site is live.
- [ ] **A5. Staging environment.** A second deployed instance pointed at `od-dev.tmweb.ru` (current dev WP) so Design + content editors can preview before prod.

---

## Workstream B — WordPress / data layer

The repo currently consumes `/wp/v2/posts`, `/wp/v2/menus`, `/wp/v2/menu-items`, and footer endpoints. Every section beyond news needs corresponding WP content types and fetchers.

- [~] **B1. Inventory WP content types.** Done — see [`wp-backend.md`](./wp-backend.md) §3 (CPTs, taxonomies) and §4 (plugin landscape). Confirmed CMS-driven: `project`, `profile` (team), `leyka_donation`, `leyka_campaign`. Confirmed missing in the data model: any kind of `material`, `faq`, or `video` CPT — those need to be created (or live as plain pages) before D5/D7/D8 can build. **Action remaining:** decide content shape for materials / FAQ / video and create the CPTs.
- [ ] **B2. Regenerate `wp-json-openapi.ts` after each WP schema change.** Confirm `redocly.yml`'s target (`https://od-dev.tmweb.ru/wp-json-openapi`) stays in sync. Document the regen step in `CLAUDE.md` (already covered) and in the team workflow.
- [ ] **B3. Standardise fetcher pattern.** Every `src/shared/api/fetch*.ts` should follow the same shape: typed via openapi-fetch + `next: { tags: [...] }` for on-demand revalidation. Add `cachedFetch*` variants where used twice in one render (see existing `cachedFetchNews`).
- [ ] **B4. On-demand revalidation.** Add `app/api/revalidate/route.ts` (covered in earlier conversation — secret-gated POST that calls `revalidatePath` / `revalidateTag`), plus the WP-side webhook (`save_post` / `transition_post_status`). Today WP edits only propagate via the SWR window.
- [x] **B5. Identify custom WP plugins.** Done — see [`wp-backend.md`](./wp-backend.md) §4. `wp-block-cb-carousel-v2` comes from the **carousel-block** plugin (Codeboxr, v2.0.5). Full plugin inventory captured.
- [ ] **B8. WordPress cleanup — kill the page-builder and unsupported UI plugins.** Headless = WP only serves data, so the bulk of the current 26 active plugins are dead weight. Target list and ordering captured in [`wp-backend.md`](./wp-backend.md) §4. **Good news from the data audit:** `profile` records (205, real OD coordinators) are **already migrated to Gutenberg blocks** by `cmsms-gutenberg-upgrade` — no data-migration script needed. `project` records (21, all 2015 Lorem-ipsum drafts) are deleted outright. Critical path:
  1. **Build / pick the headless theme** (custom 5-file minimal or stock Twenty Twenty-Five). Register `profile` + `pl-categs` in its `functions.php` with the same slug + `'show_in_rest' => true`. Do **not** re-register `project` / `pj-categs` / `pj-tags`.
  2. **Verify** `/wp/v2/profile` still returns content with cmsms deactivated (toggle off, don't delete yet). **Unblocks D3 (team).** D6 (projects) is unblocked separately — projects come from plain WP pages, not the dead `project` CPT.
  3. **(Optional)** Install **ACF** only if editors want structured side-fields surfaced (e.g. region, phone, email as first-class API fields rather than buried in post body). Not required to ship.
  4. **Delete the 21 `project` drafts** (`wp post delete <id> --force` loop) before removing cmsms.
  5. **Migrate or accept loss of** `wp-block-cb-carousel-v2` markup in existing news posts before removing `carousel-block` (cleanest path: bulk-replace with core `wp-block-gallery` via a WP-CLI script, since `parsePost.tsx` already handles galleries).
  6. **Deactivate + delete** in this order: welfare → cmsms-content-composer / cmsms-gutenberg-upgrade → all UI/shortcode plugins (carousel-block, owl-carousel, shortcodes-ultimate, page-list, wp-category-posts-list, author-avatars, all_in_one_bannerWithPlaylist, infogram, display-categories-widget, simple-blog-stats, simple-lightbox, wp-code-highlightjs, clearfy-pro, google-sitemap-generator) → optional UX plugins (classic-editor, cimy-user-manager, taxonomy-terms-order, loco-translate, ewww-image-optimizer) → emergency-only tools (debug, wp-downgrade).
  7. **(Optional) Hygiene pass:** drop dead `cmsms_*` and `nvp_content_copy` postmeta rows via `wp db query` (saves a few MB, tidies API output).
  8. **Replace wysija-newsletters** if newsletter functionality is in scope.
  9. **Decide on leyka** based on whether donations stay on this WP instance or move entirely to `помоги.общее-дело.рф`.
  10. **Decide on wp-graphql** — keep if we commit to GraphQL anywhere, drop otherwise.
  End state: **~5 active plugins** (CF7, wp-openapi, wp-optimize, query-monitor, + leyka/wp-graphql if kept, + ACF if structured fields are wanted). Removing clearfy-pro also kills the WP-CLI redirect gotcha entirely.
- [ ] **B6. Forms submission backend.** The live site has **no embedded forms** — contact is a directory, participation routes to email, reviews go offsite. Every form in the Figma redesign (`contact-page`, the participation scratch, "subscribe to news") is **net-new**. **Submission target is settled**: data lands in the existing RU-hosted WordPress backend (which already holds the rest of the org's content under 152-FZ), via either a WP plugin endpoint (Contact Form 7 / Gravity Forms / WPForms) or a custom `app/api/*` route that proxies to WP REST. Spam protection: **Yandex SmartCaptcha** (not reCAPTCHA — same regulatory bucket as GA). Email notifications go out via WP's existing mail configuration; no separate transactional provider needed unless WP isn't set up for it.
- [ ] **B7. Search.** Live site doesn't have one. Redesign header carries a `SearchIcon`. Treat as **out of scope** unless Design explicitly confirms — and if it goes in, decide WP REST search vs external (Algolia / Meilisearch / Yandex Search API).

---

## Workstream C — Design system completion

Build out the primitives that all subsequent pages will compose. Order roughly matches dependency from [`page-mocks.md` §4.4](./page-mocks.md#44-suggested-build-order).

- [ ] **C1. `Button` wrapper.** Today every site uses Radix `<Button>` inline. Add `src/shared/ui/components/Button/` mapping intent (primary / secondary / link / ghost) → Radix variant + size. Flag the Figma `cornerRadius: 5` vs `radius="full"` question with Design when implementing — not a blocker, just confirm before locking it in.
- [ ] **C2. `IconButton` wrapper.** Same pattern.
- [ ] **C3. `PageHeader` (hero) component.** Used on every non-news page; missing today.
- [ ] **C4. `Pagination`.** Blocks `/news` index and every `Материалы` listing.
- [ ] **C5. `Tabs`.** Materials sub-section switcher; participation-form role tabs.
- [ ] **C6. `Dropdown` / `Select`.** Video filter.
- [ ] **C7. `Checkbox`.** Forms — contact, participation, filter.
- [ ] **C8. Standalone `Carousel`.** The repo has Swiper in deps but consumes it indirectly via WP block CSS. Need a reusable shared component for home/about/project carousels.
- [ ] **C9. Promote `header-v2` once Design finalises it.** Currently a frame, not a component — and the live `modules/Header` is on the older `header` / `header-scroll`. Plan for a clean swap.
- [ ] **C10. Modal review.** Current `Modal` is a custom portal — fine but inconsistent with the otherwise-Radix stack. Decide whether to migrate to `@radix-ui/react-dialog` for accessibility / focus-trap parity.

---

## Workstream D — Pages

Each item is "build the route + connect it to WP + ship desktop + mobile". Order is the suggested build order from page-mocks.

- [ ] **D1. Home (`app/page.tsx`)** — frame `1622:10641` (desktop), `1356:15986` (mobile). Highest priority since `/` currently has no handler.
- [ ] **D2. News index (`app/news/page.tsx`)** — frame `753:418`. Closes the dangling news flow.
- [ ] **D3. About (`app/about/`)** — Figma mocks cover index + `team`, `team-2`, `documents`, `story`, `letters`, `charter`, `certificate` (~6 routes). Live site has 11 sub-pages (adds `smi`, `nashi_partnery`, `experts-review`, `reviews`, `ostavit-otziv`, `statistics`). Resolve scope with Design before committing — the gap is meaningful.
- [ ] **D4. Contacts (`app/contacts/`)** — landing + form page. Depends on B6 (forms backend) and C7 (checkbox).
- [ ] **D5. FAQ (`app/faq/`)** — frame `1569:13336`, uses existing `Accordion`. Near-trivial once content is wired.
- [ ] **D6. Projects / Программы (`app/projects/`)** — index + per-project pages. Note label drift: live site labels this **«ПРОГРАММЫ»**, Figma has **«проекты»**. Confirm canonical label. Hard-coded vs CMS-driven: live site presents these as static programme pages, suggesting hard-coded entries are fine.
- [ ] **D7. Video / Фильмы (`app/video/`)** — index + filter + player + download flow. Live site confirms 5 sub-categories (full films, animated, clips, shorts, famous people) — that's the filter taxonomy. Depends on C6 (dropdown), C7 (checkbox), C4 (pagination), and the download-asset strategy.
- [ ] **D8. Materials (`app/materials/`)** — biggest section. Live site confirms taxonomy: methodical guides, printed (DVDs / books / bookmarks / flyers / car stickers), social advertising (posters / billboards / stickers / LED clips / audio clips), articles. ~14 sub-pages, asset volumes up to 88 items per page. Build last; depends on C4 (pagination), C5 (tabs), and a clear asset-hosting story (see Workstream E).
- [ ] **D9. Volunteer / participation page** — the loose `1101:*` scratch in Figma. Confirm with Design whether this is still in scope and where it lives (`/volunteer`? `/participation`? part of `/about`?).

---

## Workstream E — Media & assets

Materials and Video are media-heavy. Worth treating as its own concern.

- [ ] **E1. Asset hosting decision.** WP media library (default) is fine for hundreds of items but creaks for tens of thousands. If Materials really grows to 200+ posters + 65+ stickers + 88+ posters + …, plan for object storage (S3 / Yandex Object Storage) or a CDN in front of WP. Affects `next.config.ts` `images.remotePatterns`.
- [ ] **E2. Image optimisation strategy.** `next/image` works well with `remotePatterns` but generates one optimised set per origin. Confirm what survives the Docker `standalone` build, especially under multi-replica (see A2).
- [ ] **E3. File downloads.** "Скачать фильм" implies downloadable video/material files. Direct WP-media link? Pre-signed S3 URL? Track-and-redirect? Spec needed.
- [ ] **E4. Video player.** `video-page` mocks imply a player UI distinct from raw `<video>`. HLS via [Plyr](https://plyr.io/) / [Vidstack](https://vidstack.io/), or just `<video controls>`? Depends on whether videos are short clips or long documentaries.

---

## Workstream F — Quality & polish

Cross-cutting concerns that should be set up early but iterated on continually.

- [~] **F1. Testing.** Rationale: AI-first development thrives on fast feedback — cheap unit/component tests catch regressions when an agent edits many files in one pass, far better than relying on manual review of each diff. Concrete stack: **Vitest** (unit + component, fast watch mode), **React Testing Library + jsdom** (behaviour-level component tests), **Playwright** (E2E for golden-path flows, leveraging the existing `playwright-extension` MCP). **Done so far:** Vitest 4 + RTL 16 + jsdom wired up via `vitest.config.ts` / `vitest.setup.ts` with `vite-plugin-svgr` + native Vite tsconfig-paths; `pnpm test` / `test:watch` / `test:coverage` scripts; seed unit tests on `sortNavItems` + `toNavItems`; seed component test on `Breadcrumbs`. Convention: `*.test.ts(x)` colocated with source, explicit `vitest` imports, wrap Radix-flavoured components in `<Theme>`. **Still open:** Playwright pass for golden-path flows once a route or two are built, and CI gate (A3).
- [ ] **F2. Accessibility audit.** WCAG 2.1 AA pass once the design system stabilises. Radix Primitives give a strong baseline but custom components (Carousel, header navigation, forms) need explicit review.
- [ ] **F3. Core Web Vitals / Lighthouse budget.** Set targets (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) and wire to CI as a gate.
- [ ] **F4. SEO baseline.** `robots.txt`, `sitemap.xml` (dynamic from WP), Open Graph everywhere, JSON-LD structured data for news articles and the org itself. Currently only news posts have OG metadata.
- [ ] **F5. Russian-specific polish.** Verify font fallbacks render Cyrillic correctly on Windows / older Android. Confirm Russian typographic conventions (em-dashes, non-breaking spaces, quotation style — `«…»` confirmed by the live site's privacy policy).
- [ ] **F6. 152-FZ / data-protection compliance.** Concrete inputs from the live site: privacy policy text is mostly reusable (operator name, ОГРН, scope, user rights) — port it to `/conf_politics/` equivalent route, but **strip the Google Analytics reference** (GA is no longer in use). Consent UX: cookie banner gating Yandex Metrica only, plus per-form consent checkbox with the existing wording pattern *«Заполняя соответствующие формы, Пользователь выражает свое согласие…»*. Footer must keep the СМИ registration line and the **12+** content rating. No GDPR notice needed.

---

## What I'd need access to

To execute any of this efficiently, the following access would unblock work that's currently guess-driven. Listed in priority order:

1. **WordPress admin OR WP-CLI access** — without it, every fetcher (Workstream B) is reverse-engineered from the OpenAPI schema. With it: read content types, inspect custom fields, validate fixture data, regenerate types after schema changes.
2. **The `wp-block-cb-carousel-v2` plugin source.** The repo's `parsePost.tsx` special-cases it but nothing documents what it actually renders or what other markup ships with it.
3. **Production / staging SSH (or whatever the deploy target is).** A2 (hosting decision) can't land without knowing what's already there.
4. **Figma developer mode / Dev Mode MCP.** The current `TalkToFigma` connection gives structural data but rough measurements only; Dev Mode exposes spacing/auto-layout/exported assets directly.
5. **Browser automation for verification.** I have access to `playwright-extension` and `browserbase` MCP servers — useful for verifying built pages match Figma post-build, but neither has Figma access. So this complements, doesn't replace, the above.
6. **Analytics / Sentry / hosting dashboards** (whichever the team picks in A4). Read-only at minimum; eventually write to add the relevant SDKs.
7. **Forms backend credentials** once B6 is decided.

---

## Open questions

These are real decisions that need a human (Design / PM / org leadership) before the corresponding work can land. Not exhaustive — more will surface as each workstream starts.

### Design / scope
- Brand red drift (`#F4322A` Figma vs `--red-8 #ae0a04` code) — which is canonical?
- Button corner radius: Figma `5px` vs Theme `radius="full"`. Pill or rounded?
- Are the Inter typography styles on the `👉 UI` page deprecated or in use somewhere I haven't found?
- For pages without an explicit `-mob` Figma frame, is it responsive-only or are mobile mocks coming?
- `header-v2` (loose frame) — when does it replace the current `header` / `header-scroll`?
- Status of the loose "Стань волонтером" iterations and the `1101:*` participation-form scratch — still in scope?

### Content modelling
- Are `project-1/2/3` hard-coded site pages or CMS-driven post-type entries?
- Are team members a custom post type with photo/bio fields, or static JSON?
- For Materials, is each sub-category (flyers, posters, books…) a separate WP post type, taxonomy of a generic "material" type, or static asset listing?
- How will news categories / regions surface in the UI? `cachedFetchNews` returns `categories` but no UI handles them yet.

### Behaviour
- Forms: where do submissions go, and what spam protection is required (Yandex SmartCaptcha is the safe default since GA/reCAPTCHA are off the table)?
- "Скачать фильм" — modal or dedicated page? Tracked or anonymous download?
- ~~Does the site need a global search?~~ — **Live site has no search**; treat as out of scope unless Design says otherwise.
- ~~Multilingual support?~~ — **Russian only confirmed** (no language switcher on live site).
- Authentication for any pages (admin previews, donor-only content)?
- Section label: «ПРОГРАММЫ» (live) vs «проекты» (Figma) — pick one.
- Donation CTA: should home/header link to `помоги.общее-дело.рф`? Currently a top-bar item on the live site.

### Infra
- Where does this deploy? Single VPS, K8s, managed platform? (Foreign hosting is on the table — see A2.)
- Acceptable cache staleness for editor changes — is 1-hour SWR enough, or is on-demand revalidation a hard requirement before launch?
- Backup / disaster-recovery story for WP and uploads?
- Are the sibling properties (`od-pro.ru`, `помоги.общее-дело.рф`, `статы.общее-дело.рф`, `общее-дело.рф` punycode alt) part of this redesign, or strictly cross-links?

---

## Rough sequencing (not commitments)

If I had to draw a line through this:

1. **Block 1 (parallelisable)**: A2, A3, A4, B1 (decide remaining CPTs), B8 (start the WP cleanup — mu-plugin for CPTs first) — unblock everyone. (A1 is downgraded from a decision step to a designer-confirmation note — not on the critical path.)
2. **Block 2**: B2, B3, B4, C1, C2, C3, **B8 finish** (delete trashed plugins, swap theme) — primitives + reliable data path on a clean WP.
3. **Block 3**: D1, D2, C4 — ship the most-visible routes.
4. **Block 4**: D3, D5, D6, C5, C8 — fill in the static-ish sections (D3/D6 unblocked by B8).
5. **Block 5**: B6, D4, C7 — forms-dependent.
6. **Block 6**: E1–E4, C6, D7, D8 — the media-heavy long tail.
7. **Continuous from Block 1**: F1–F6 — quality concerns.

Sequencing assumes one or two people; with more headcount, Workstreams C, D, and the media/asset E chain parallelise cleanly once Block 1 is done.
