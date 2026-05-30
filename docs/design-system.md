# Design system — Figma ↔ Repo

This is a working map between the **Figma `👉 UI` page** (the canonical design system) and the **repo's `src/shared/`** implementation. It is intentionally narrative — it captures what is built, what is not, and where the two have drifted.

Last verified against Figma: 2026-05-29.

---

## 1. Where the system lives

| Side | Location |
| --- | --- |
| Source of truth | Figma file, page **`👉 UI`** (`1297:4635`). The main `design` page hosts page mocks that consume these components. |
| Tokens (runtime) | `src/shared/ui/theme/radix/theme-override.css` — CSS custom properties on `:root` + `.radix-themes`. |
| Theme entry | `src/shared/ui/theme/radix/radix-provider.tsx` — wraps the app in a Radix `<Theme accentColor="red" radius="full">` and imports both `@radix-ui/themes/styles.css` and the override file. |
| Breakpoint media | `src/shared/ui/styles/media.css` (`@custom-media` rules: `--mobile <900`, `--small-desktop <1440`, `--desktop ≥1440`). Auto-injected globally by `@csstools/postcss-global-data`. |
| Global resets | `src/shared/ui/styles/global.css` — pulls `normalize.css`, `swiper/swiper-bundle.css`, and a `box-sizing: border-box` reset. |
| Component primitives | `src/shared/ui/components/<Name>/` — each component is a tiny wrapper over a Radix Themes / Radix Primitives component. |
| Icons | `src/shared/ui/assets/icons/*.svg` imported as React components via `@svgr/webpack` (configured under `turbopack.rules` in `next.config.ts`) and re-exported with consistent prop typing from `src/shared/ui/components/Icons/`. |

**Implementation pattern.** The project does **not** ship its own primitive library. Radix Themes is the primitive layer; the design system lives entirely in (a) the `theme-override.css` variable overrides and (b) thin `src/shared/ui/components/*` wrappers that compose Radix pieces with project conventions (icons, label/message slots, color enums, Next.js Link routing, etc.). When you change a token in `theme-override.css`, every Radix component picks it up automatically.

---

## 2. Tokens

### 2.1 Colors

Figma defines **five** named color styles. The repo defines a **fuller scale** (1–10 for red and gray) plus auxiliary `--white` and `--danger-*`. The two are *not* a 1-to-1 mapping; the Figma styles describe semantic roles, the repo defines a scale that Radix expects.

| Figma style | Hex | Closest repo var | Notes |
| --- | --- | --- | --- |
| `1_main_black` | `#151313` | (no exact match — `--gray-10` is `#141c24`) | Used for body text in mocks; in repo, body text falls back to Radix defaults that resolve to the gray scale. Pure-near-black is **not** explicit in the override. |
| `2_main_red` | `#F4322A` | (no exact match — `--red-5` is `#f55555`, `--red-6` is `#d83030`) | The Figma red is brighter than any repo red step. The brand red in code is **`--red-8` (`#ae0a04`)**, used as the default solid button background via `.rt-BaseButton.rt-variant-solid` and `Theme accentColor="red"`. Drift worth flagging — see open questions. |
| `3_gray` | `#6C6C6C` | `--gray-6` (`#637083`) | Used for secondary text. Repo uses Radix `<Text color="gray">` which resolves to `--gray-6` via the override (`.rt-Text[data-accent-color='gray']`). |
| `4_line_gray` | `#BDBDBD` | `--gray-4` (`#ced2da`) | Used for borders/dividers. No direct rule wires it up — borders in the repo lean on Radix defaults. |
| `white` | `#FFFFFF` | `--white` (`#fff`) | Match. |

Repo also defines (in `theme-override.css`):

- `--color-background: var(--gray-2)` (page background — set on `html, body` in `global.css`)
- `--red-1` through `--red-10` (the full Radix scale, custom values)
- `--gray-1` through `--gray-10` (custom Radix scale)
- `--danger-1`, `--danger-9` (Radix's danger-color hook)
- Cursor overrides for Radix interactive elements (`--cursor-button: pointer`, etc.)

### 2.2 Typography

**Repo fonts** are loaded via `next/font/google` in `app/layout.tsx`:

- `PT Sans` (regular 400, bold 700) → `--font-pt-sans`
- `PT Sans Narrow` (bold 700) → `--font-pt-sans-narrow`
- `--default-font-family` is overridden to `'PT Sans', 'Helvetica Neue', …`.
- `PT Sans Narrow` is opted into for `--font-size-9` (largest scale) via a Radix selector override: `.rt-Text.rt-r-size-9`.

**Figma typography** has two parallel families:

1. **Inter** (legacy — likely from an earlier draft): `H1_Inter_Semi-Bold_32`, `H2_…_Medium_24`, `H3_…_Medium_18`, `Body_…_Regular_16`, `Body2_…_Regular_14`. **The repo does not use Inter.** Treat these styles as deprecated unless Design says otherwise.
2. **PT Sans scale** (current): `text/1/regular` … `text/9/bold`. This matches the Radix `--font-size-N` scale exactly:

| Figma style | Size | Family | Repo `--font-size-N` |
| --- | --- | --- | --- |
| `text/1/regular` | 12 | PT Sans | `--font-size-1` (12) |
| `text/2/regular` | 14 | PT Sans | `--font-size-2` (14) |
| `text/3/regular` / `text/3/bold` | 16 | PT Sans | `--font-size-3` (16) |
| `text/4/regular` / `text/4/bold` | 18 | PT Sans | `--font-size-4` (18) |
| `text/5/regular` / `text/5/bold` | 22 | PT Sans | `--font-size-5` (22) |
| `text/6/regular` / `text/6/bold` | 24 | PT Sans | `--font-size-6` (24) |
| `text/7/regular` / `text/7/bold` | 28 | PT Sans | `--font-size-7` (28) |
| `text/8/bold` | 32 | PT Sans | `--font-size-8` (32) |
| `text/9/bold` | 48 | PT Sans Narrow | `--font-size-9` (48) + family switch |

Line heights are mostly 140% (`--line-height-1..6`), tightening to 120%/130%/120% for sizes 7–9. `--letter-spacing-9` is `2%` (the Narrow display style); everything below is `0%`.

**How to consume in code.** Always go through Radix `<Text>` / `<Heading>` with `size="1".."9"`. Do not hard-code font sizes — they resolve to `var(--font-size-N)` and stay in sync if the override changes.

### 2.3 Effects (shadows)

| Figma style | Repo var | Value |
| --- | --- | --- |
| `shadow/sm` | `--shadow-sm` | `0px 2px 10px 0px rgba(0, 0, 0, 0.07)` |
| `shadow/lg` | `--shadow-lg` | `0px 10px 20px -15px rgba(14, 18, 22, 0.2)` |

Match by name. The numeric values in the override are the source of truth — if Figma's shadow specs change, sync them here.

### 2.4 Containers

Repo-only — Figma doesn't expose container widths as styles, but the page mocks imply them:

- `--container-1: 100%`
- `--container-2: 100%`
- `--container-3: 860px`
- `--container-4: 1240px`

Used by Radix's `<Container size="N">`. The repo also has a custom `<Container>` (`src/shared/ui/components/Container/`) that's a plain wrapper for `<main>` with a class — distinct from Radix's, easy to confuse.

### 2.5 Breakpoints

Defined in `src/shared/ui/styles/media.css` as `@custom-media`:

- `--mobile (width < 900px)`
- `--small-desktop (width < 1440px)`
- `--desktop (width >= 1440px)`

Globally available via `@csstools/postcss-global-data` (PostCSS config). The `Box` primitive (see §4.1) accepts responsive props keyed on these same names.

### 2.6 Spacing scale

**Repo-only** — Figma doesn't expose spacing as styles. The `Box` primitive constrains spacing to a 12-step scale: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64`. Page mocks use values within this scale; using `Box` props automatically keeps you compliant.

---

## 3. Component inventory

Status legend: ✅ implemented, ⚠️ partial / drift, ❌ not built.

### 3.1 Components present on the Figma `👉 UI` page

| Figma frame | ID | Status | Repo location | Notes |
| --- | --- | --- | --- | --- |
| `color` | `1298:5540` | ✅ tokens | `theme-override.css` | Drift on `2_main_red` and `1_main_black` — see §2.1. |
| `effect` | `1326:310` | ✅ tokens | `theme-override.css` (`--shadow-sm`, `--shadow-lg`) | Match by name. |
| `Typography` | `1320:5044` | ✅ tokens | `theme-override.css` font-size/line-height/letter-spacing scales + PT Sans loader in `app/layout.tsx` | Inter styles in Figma are legacy/unused. |
| `icon` | `1320:5066`, `1326:6821` | ✅ | `src/shared/ui/assets/icons/*.svg` + `src/shared/ui/components/Icons/*.tsx` | 21 SVGs in place; each has a typed React-component wrapper. Two `icon` frames in Figma — likely a sheet + a single-icon spec. Worth confirming all Figma icons exist as SVGs (current set: add-outlined, arrow-right, chevron up/down/left/right, circle-play, cross, cross-circle-filled, download, exclamation-outlined, hexagon, info, info-outlined, menu, search, warning, vk, odnoklassniki, youtube, logo.webp). |
| `button` | `1300:4731`, `1321:5303` | ⚠️ | (no project Button wrapper) | The repo uses Radix `<Button>` inline. Custom variant CSS lives in `theme-override.css` (`.rt-BaseButton.rt-variant-solid`/`outline`/`classic`/`soft`/`ghost`/`surface`, plus padding tweaks for `rt-r-size-2`/`rt-r-size-3`). No dedicated wrapper component — `solid`/`outline`/`soft`/`ghost`/`surface` are all themed and ready to use, but project conventions for "which variant for which intent" are not documented here yet. The two button frames in Figma likely correspond to (a) the canonical Button + Links variants and (b) a smaller-scope spec — both with corner radius 5; the repo uses `radius="full"` on the Theme provider. **Mismatch:** Figma buttons have `cornerRadius: 5`, repo Theme is `radius="full"` (pill). Confirm with Design. |
| `icon-button` | `1327:14974` | ❌ | (Radix has `<IconButton>` primitive, used inline; no wrapper) | `theme-override.css` zeroes its padding (`.rt-IconButton { padding: 0 }`). No component wrapper, no documented variants. |
| `button-groups` | `1326:16966` | ✅ | `src/shared/ui/components/ButtonGroup/` | Built on Radix `<NavigationMenu>` primitives (not Radix Themes). Supports a flat `items[]` with optional `content` for sub-menus (rendered via `ButtonGroupSubMenu`). |
| `input` | `1321:5552` | ✅ | `src/shared/ui/components/input/` (lowercase dir) | Wrapper around Radix `<TextField.Root>` adding: `label`, `message`, `leftIcon`/`rightIcon`, `error`, and a `color: 'gray' | 'red'` enum. `--text-field-height: 48px` and `border-radius: var(--radius-full)` set in `theme-override.css`. Note: the import path is `@/shared/ui/components/input` (lowercase) — odd but it's how it's exported. |
| `dropdown` | `1321:5794` | ❌ | — | Not built. Radix primitives (`@radix-ui/react-dropdown-menu`) are not yet pulled in. |
| `pagination` | `1321:5809` | ❌ | — | Not built. No usage site yet either (no `/news` index page, no listings). |
| `Carousel` | `1326:2019` | ⚠️ | `swiper` is in deps (`11.2.6`) and `swiper-bundle.css` is imported globally; WP post bodies render carousels via `wp-block-cb-carousel-v2` and styled by `@wordpress/block-library` CSS through `<GutenbergProvider>`. No project `Carousel/` component exists. | The "current" carousel is WordPress-driven inside post content, not a reusable shared component. The Figma `Carousel` frame implies a standalone version that hasn't been built. |
| `checkbox` | `1321:6119` | ❌ | — | Not built. |
| `breadcrumbs` | `1321:5852` | ✅ | `src/shared/ui/components/Breadcrumbs/` | Uses internal `<Link>` (which composes Next.js + Radix Link) and a `<ChevronRight>` icon as default separator. Accepts `items: { label, href? }[]` — last item rendered as bold gray text. |
| `tabs` | `1321:4794` | ❌ | — | Not built. |
| `navigation` | `1327:13588` | ✅ | `src/modules/Header/` | Server/client split: `HeaderServer.tsx` fetches the `main-navigation` menu via WP and maps it through `toNavItems`, then renders `HeaderClient.tsx`. Sticky-scroll variant exists in Figma (`header-scroll`) — confirm coverage. |
| `page header` | `1335:7813` | ❌ | — | Page hero / banner block. Not built. |

### 3.2 Components present in the repo but **not** on the `👉 UI` page

These are practical primitives added during build-out that the design system page hasn't formalized. If/when Design wants to spec them, they'll need a Figma entry.

| Repo component | Location | What it does |
| --- | --- | --- |
| `Box` | `src/shared/ui/components/Box/` | Layout primitive with responsive object props (`{ mobile, smallDesktop, desktop }`) for padding (`p/pt/pr/pb/pl/px/py`), margin (`m*`), display, flex (direction/wrap/justify/align), position, top/right/bottom/left. Spacing values constrained to `0/4/8/12/16/20/24/32/40/48/56/64`. **The single most-used layout tool in the codebase** — prefer it over ad-hoc CSS for spacing shells. |
| `Container` | `src/shared/ui/components/Container/` | Simple `<main>` (or chosen `as`) wrapper with a `.container` class. Distinct from Radix's `<Container>`. |
| `Link` | `src/shared/ui/components/Link/` | Composes Next.js `<Link>` + Radix `<Link>` + project color enum (`red | gray | white | lightgrey | darkgrey`) + optional left/right icons. **Use this instead of either Next.js or Radix Link directly.** |
| `Logo` | `src/shared/ui/components/Logo/` | Brand logo rendered with the `logo.webp` asset. |
| `Modal` | `src/shared/ui/components/Modal/` | Client-only portal-based modal with `useClickAway` + Escape-to-close + `overflow:hidden` body lock. Not built on Radix Dialog — intentional or pre-Radix? Worth revisiting if Radix Dialog would do the job. |
| `Accordion` | `src/shared/ui/components/Accordion/` | Wrapper over `@radix-ui/react-accordion` (the primitive, not Themes) accepting `items: { value, href?, text?, content? }[]`. Trigger is a `<Text>` or `<Link>` depending on `href`; chevron icon flips via CSS. Supports both single- and multi-open modes via Radix's union type. |
| `Icons/*` | `src/shared/ui/components/Icons/` | Typed wrappers around each SVG with consistent prop signature. Source of truth for the icon set — adding an icon means dropping the SVG into `assets/icons/` and exporting a wrapper here. |

---

## 4. Operating notes for future work

### 4.1 When you reach for a new visual primitive

1. Check `src/shared/ui/components/` first.
2. If nothing fits, use Radix Themes / Radix Primitives directly — but if you find yourself styling the Radix component the same way twice, lift it into `src/shared/ui/components/<Name>/`.
3. Never hard-code colors, font sizes, shadows, or line heights — go through the `--*` custom properties in `theme-override.css`. If a value isn't there, add it (and note it here).

### 4.2 When Figma changes

The high-leverage edits are in `theme-override.css`. The rest of the system inherits automatically because every component is themed through Radix variables. Specifically:

- **Color change** → update the corresponding `--red-N` / `--gray-N` / `--white` value.
- **New type size** → add `--font-size-N` (and matching `--line-height-N` / `--letter-spacing-N`).
- **Shadow change** → update `--shadow-sm` / `--shadow-lg` directly.

### 4.3 Open questions / known drift

These are real mismatches between Figma and code worth confirming with Design before treating one or the other as correct:

- **Brand red.** Figma's `2_main_red` is `#F4322A`. The repo's solid button uses `--red-8` = `#ae0a04` (much darker). Which is canonical?
- **Button corner radius.** Figma button frames carry `cornerRadius: 5`. Repo Theme is `radius="full"` (pill). Probably an intentional global decision — confirm.
- **Inter typography.** The five `H1_Inter_*` / `Body_Inter_*` Figma styles look orphaned. Safe to delete from Figma?
- **`1_main_black` for body.** Nothing in the override sets a pure-near-black for body text — Radix defaults resolve text to gray-12 (via Radix's own scale). If Design intends `#151313` as the literal body color, we need to wire it up.
- **`4_line_gray` borders.** Not referenced anywhere in the override. If used in mocks, callers currently get Radix defaults instead.

### 4.4 Components that are obvious next builds

If a sprint targeted "complete the design system", the unbuilt items in order of likely demand:

1. `Button` wrapper (variant intent map: primary / secondary / link / icon-only)
2. `IconButton` wrapper
3. `Checkbox` (forms work)
4. `Dropdown` (forms / select menus)
5. `Tabs`
6. `Pagination` (needed before `/news` index can ship)
7. Standalone `Carousel` (separate from WP block carousel)
8. `PageHeader` (hero block — needed for every non-news page in the mocks)

---

## 5. Reading the Figma file

Useful node IDs for fast navigation (paste into Figma's URL bar after `?node-id=`):

- Page `👉 UI` — `1297:4635`
- color — `1298:5540` · effect — `1326:310` · Typography — `1320:5044`
- button — `1300:4731` and `1321:5303` · icon-button — `1327:14974` · button-groups — `1326:16966`
- input — `1321:5552` · dropdown — `1321:5794` · checkbox — `1321:6119`
- breadcrumbs — `1321:5852` · tabs — `1321:4794` · pagination — `1321:5809`
- navigation — `1327:13588` · page header — `1335:7813` · Carousel — `1326:2019`
- icon sheets — `1320:5066`, `1326:6821`

The page-mock canvas lives on the sibling `design` page (id `168:717`) — frames named `Главная` and `Стань волонтером` (multiple iterations each), plus section pins for о нас / проекты / видео / контакты / новости / Ответы на частые вопросы / Материалы / главная.
