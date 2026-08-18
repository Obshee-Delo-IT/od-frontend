# Design system — Figma ↔ Repo

This is a working map between the **Figma `👉 UI` page** (the canonical design system) and the **repo's `src/shared/`** implementation. It is intentionally narrative — it captures what is built, what is not, and where the two have drifted.

Last verified against Figma: **2026-08-13** for the header, footer and `Links` component sets (C9–C11); **2026-05-30** for everything else. Via the `figma-mcp-go` MCP — it gives variables, paints, text/effect styles, and component sets at a fidelity the earlier `TalkToFigma` scout couldn't reach. (Practical technique: navigate by frame **name** down to a small sub-frame — `search_nodes` → `get_node` → `save_screenshots`; whole-page reads time out.)

Repo-side status last verified against the code: **2026-08-13**. **Workstream C is closed** — the C1–C8 primitives that §3 once listed as missing, then the header, footer, `Modal` and `Link` (C9–C11). See [`implementation-notes.md` §2](./implementation-notes.md#2-shipped--design-system-c) for the per-component build notes and the bugs the C9 measurements turned up.

---

## 1. Where the system lives

| Side | Location |
| --- | --- |
| Source of truth | Figma file «Общее дело редизайн (Copy)», page **`👉 UI`** (`1297:4635`). The sibling `design` page hosts page mocks that consume these components (see [`page-mocks.md`](./page-mocks.md)). |
| Tokens (runtime) | `src/shared/ui/theme/radix/theme-override.css` — CSS custom properties on `:root` + `.radix-themes`. |
| Theme entry | `src/shared/ui/theme/radix/radix-provider.tsx` — wraps the app in a Radix `<Theme accentColor="red" radius="full">` and imports both `@radix-ui/themes/styles.css` and the override file. |
| Breakpoint media | `src/shared/ui/styles/media.css` (`@custom-media` rules). Auto-injected globally by `@csstools/postcss-global-data`. |
| Global resets | `src/shared/ui/styles/global.css` — pulls `normalize.css`, `swiper/swiper-bundle.css`, and a `box-sizing: border-box` reset. |
| Component primitives | `src/shared/ui/components/<Name>/` — each component is a tiny wrapper over a Radix Themes / Radix Primitives component. |
| Icons | `src/shared/ui/assets/icons/*.svg` imported as React components via `@svgr/webpack` (configured under `turbopack.rules` in `next.config.ts`) and re-exported with typed wrappers from `src/shared/ui/components/Icons/index.tsx`. The SVG set is the design set; the wrapper list is only the icons something renders. |

**Implementation pattern.** The project does **not** ship its own primitive library. Radix Themes is the primitive layer; the design system lives entirely in (a) the `theme-override.css` variable overrides and (b) thin `src/shared/ui/components/*` wrappers that compose Radix pieces with project conventions (icons, label/message slots, color enums, Next.js Link routing, etc.). When you change a token in `theme-override.css`, every Radix component picks it up automatically.

---

## 2. Tokens

The Figma file has **two layers** of design tokens:

1. **Variables** (Figma Variables / `boundVariables`) — the canonical token system. Lives in collection `UI` (`VariableCollectionId:838:1702`) with **Light + Dark** modes (only Light is meaningfully filled today; Dark is partly aliased to a different library). Variables cover spacing, radius, border-width, and a full color system across five scales (brand red, gray, Warning, Danger, Success — each 1–10).
2. **Paint / Text / Effect styles** — the older named-role styles (`1_main_black`, `2_main_red`, `text/3/bold`, `shadow/sm` …). These are what most components actually reference. Variables exist behind them but components don't all bind to them yet.

For repo-side consumption, both layers collapse into CSS custom properties in `theme-override.css`. The repo override is built around the Radix scale (`--red-1..10`, `--gray-1..10`), which happens to mirror the Figma variable scales closely — though the values diverge in places.

### 2.1 Colors

#### Figma variables — full scale (resolved hex, Light mode)

| Scale | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `color/brand/red` | `#FFEAEA` | `#FFCFCF` | `#FFB2B2` | `#FF8686` | `#F55555` | `#D83030` | `#BE1710` | `#AE0A04` | `#8A0707` | `#5C0202` |
| `color/gray` | `#F9FAFB` | `#F2F4F7` | `#E4E7EC` | `#CED2DA` | `#97A1AF` | `#637083` | `#414E62` | `#344051` | `#202B37` | `#141C24` |
| `color/Warning` | `#FE… ` orange-yellow scale | … | | | | | | | | |
| `color/Danger` | red-tinted neutrals | … | | | | | | | | |
| `color/Success` | green scale | … | | | | | | | | |

Warning/Danger/Success scales are present but **no current component on the UI page references them** — they're available for future system messages / status UI.

#### Figma paint styles — the "named roles" components actually use

| Figma style | Hex | Maps to which scale value | Notes |
| --- | --- | --- | --- |
| `1_main_black` | `#151313` | between `gray/10` (`#141C24`) and pure black | Used for body text. **Repo does not wire this up explicitly** — Radix `<Text>` defaults to the gray scale; if Design wants the exact `#151313`, we need to add a rule. |
| `2_main_red` | `#F4322A` | `brand/red/5` (`#F55555`) is closest | **Not what header / buttons actually render with.** The CTA chrome on `header-v2` and the canonical `Button` Contained variant both fill with **`#AE0A04` = `brand/red/8`**, not this token. The token is a brighter accent — used in scattered titling / illustrations. The button red is darker. |
| `3_gray` | `#6C6C6C` | between `gray/5` and `gray/6` | Secondary text. Repo `<Text color="gray">` resolves to `--gray-6` (`#637083`) — close. |
| `4_line_gray` | `#BDBDBD` | between `gray/4` (`#CED2DA`) and `gray/5` (`#97A1AF`) | Borders / dividers — **not referenced by any rule in the override**. Borders in the repo lean on Radix defaults. |
| `white` | `#FFFFFF` | — | Match. |

#### Repo CSS variables

In `theme-override.css`:

- `--color-background: var(--gray-2)` (page background, applied to `html, body`)
- `--red-1`..`--red-10` — custom values overriding Radix defaults
- `--gray-1`..`--gray-10` — custom values overriding Radix defaults
- `--danger-1`, `--danger-9`
- `--white: #fff`
- Cursor overrides for Radix interactive elements (`--cursor-button: pointer`, etc.)

The repo `--red-N` numbers roughly track Figma's `brand/red/N` scale but are not byte-identical. Critically, the visible button red **does** match: both resolve to `#AE0A04` at the Contained-Large state.

#### Un-tokenized colors in shipped code

The home **StatsRow** "+" accents render four hard-coded hexes — `#42C880` (green), `#C383D9` (purple), `#FFC33F` (yellow), `#6692FD` (blue) — that map to **no token**. Only `red`/`gray` (+ `white`/`danger`) are ported to `theme-override.css`; Figma has `Warning` (yellow-ish) and `Success` (green) scales but **no purple or blue scale at all**. Until Design confirms a palette these stay as literals (the one place in shipped code that violates the "never hard-code colors" rule below). Tracked in [`questions-for-designer.md`](./questions-for-designer.md) §1.1.

#### What the old docs got wrong

- The previous version flagged `2_main_red` (`#F4322A`) as Figma's "real" brand red and treated the rendered repo button as drift. Actually: the canonical Button uses `brand/red/8` (`#AE0A04`) directly via Radix's solid variant. `2_main_red` is a separate brighter accent. **Not a drift; just two different reds with overlapping intent.**

### 2.2 Spacing

Figma variables `spacing/0..9`:

| Token | Value (px) |
| --- | --- |
| `spacing/0` | 0 |
| `spacing/1` | 5 |
| `spacing/2` | 10 |
| `spacing/3` | 15 |
| `spacing/4` | 20 |
| `spacing/5` | 25 |
| `spacing/6` | 35 |
| `spacing/7` | 45 |
| `spacing/8` | 65 |
| `spacing/9` | 80 |

A **multiples-of-5** scale that compresses at the small end and stretches at the large end (no even 30/40/50/60/70).

**Repo `Box` takes any length** (`src/shared/ui/components/Box/`): a number is pixels, a string is passed through, so `py={15}` and `gap="1rem"` are both fine. Nine props, and they are the nine the app uses — `pt pb py mb gap top display flexDirection position`. Anything else (`p`, `mx`, `justifyContent`, …) is a CSS module on the call site, or three lines added back to `Box.module.css`.

It used to be a fixed multiples-of-4 scale — `0, 4, 8, …, 64` — because every step of every property was a generated CSS class, and 3 528 lines of them. Values now ride in a custom property, so the scale is gone and with it the rounding rule this section used to carry: **write Figma's number**.

### 2.3 Radius

Figma variables `radius/*`:

| Token | Value (px) | Used by |
| --- | --- | --- |
| `radius/1` | 4 | Checkbox base (16×16, `cornerRadius:4`) |
| `radius/2` | 6 | `_Button Groups Base`, Dropdown, Pagination cells, **Icon Button** (`cornerRadius:6`) |
| `radius/3` | 8 | Tab cell wrapper, Links variants (`cornerRadius:8`) |
| `radius/4` | 12 | (not actively used yet) |
| `radius/round` | 999 | **Button** (`cornerRadius:9999`), Input Field (`cornerRadius:999`), Carousel arrow buttons (`cornerRadius:999`) |

**Confirms the old "button corner radius drift" question is resolved.** The canonical `Button` is pill (`cornerRadius:9999`); the repo Theme is `radius="full"`. **They match.** The earlier docs cited an older Button master (`1321:5304`) with `cornerRadius:5` — that frame is superseded by `1297:4792` and should be ignored.

**Radix rescales this scale per element, so `var(--radius-N)` is not one number.** `<Theme radius="full">` sets a 1.5 factor app-wide, which is what makes `--radius-2` the 6px Figma draws. Any component that passes Radix a `radius` prop gets `data-radius` stamped on *its own element* and the whole scale recomputed beneath it — `radius="medium"` resets the factor to 1 and `--radius-2` silently becomes 4px there. `IconButton` maps its `curved` option to Radix `large` (the same 1.5) for exactly this reason; it read 4px everywhere before 2026-08-13.

### 2.4 Border width

Figma variables `border-width/*`: `0, 1, 2, 4, 8`. No repo variable mirror — borders in the override use raw pixel values inline. Low priority to systematize.

### 2.5 Typography

**Repo fonts** loaded via `next/font/google` in `app/layout.tsx`:

- `PT Sans` (regular 400, bold 700) → `--font-pt-sans`
- `PT Sans Narrow` (bold 700) → `--font-pt-sans-narrow`
- Both subset `['cyrillic', 'latin']`. **Planned change:** issue **#27** swaps `next/font/google` → `next/font/local` so builds don't fetch from Google (there's a `// TODO: install local fonts` in `app/layout.tsx`). Token names stay the same.
- `--default-font-family` overrides Radix's default to `'PT Sans', 'Helvetica Neue', …`.
- `PT Sans Narrow` opted into for `--font-size-9` (the largest) via Radix selector `.rt-Text.rt-r-size-9`.

**Figma typography** has two parallel families:

1. **Inter** (legacy / orphan): `H1_Inter_Semi-Bold_32`, `H2_…_Medium_24`, `H3_…_Medium_18`, `Body_…_Regular_16`, `Body2_…_Regular_14`. **The repo does not use Inter.** A few places in the page mocks still bind to these (e.g. the breadcrumb separator label in the `page header` component uses Inter Regular 15 / `#6C6C6C`). Treat as deprecated; flag for cleanup.
2. **PT Sans scale** (current): `text/1/regular` … `text/9/bold`. Maps to the Radix `--font-size-N` scale:

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

### 2.6 Effects (shadows)

| Figma style | Repo var | Value |
| --- | --- | --- |
| `shadow/sm` | `--shadow-sm` | `0px 2px 10px 0px rgba(0, 0, 0, 0.07)` |
| `shadow/lg` | `--shadow-lg` | `0px 10px 20px -15px rgba(14, 18, 22, 0.2)` + a second `0px 10px 38px -10px rgba(13, 18, 22, 0.35)` layer in Figma. The repo override is the first layer only — second layer not wired up. Minor drift; usually invisible. |

### 2.7 Containers

Repo-only:

- `--container-1: 100%`
- `--container-2: 100%`
- `--container-3: 860px`
- `--container-4: 1240px`

The `header-v2` nav row is exactly 1240px wide — matches `--container-4`. The page header's content frame is also 1240px (with 100/100 side padding inside a 1440-wide frame). So `--container-4` is the canonical content-column at the 1440 breakpoint.

`Container` now means one thing: `<Container>` from `@radix-ui/themes`, which uses the `--container-N` widths above. There used to be a second one in `src/shared/ui/components/Container/` — a `<main>` wrapper the root layout was the only caller of; it is the `.main` rule in `src/app/layout.module.css` now.

### 2.8 Breakpoints — the system is 4-tier, not 3-tier

Current `media.css`:

- `--mobile (width < 900px)`
- `--small-desktop (width < 1440px)`
- `--desktop (width >= 1440px)`

Figma reality (from the explicit `1200` and `900` demo frames inside the `navigation` UI frame, plus `header-v2` at 1440 and `header-mob` at 360):

| Width range | Header layout | Side padding | Nav font |
| --- | --- | --- | --- |
| ≥ 1440 (`header-v2`) | full 1240 nav row | 100 / 100 | `text/3/regular` (16) |
| 1200–1439 | full nav row, slightly compressed | 100 / 100 | `text/2/regular` (14) |
| 900–1199 | full nav row, slightly compressed | **20 / 20** (sharp drop) | `text/2/regular` (14) |
| < 900 (`header-mob`) | compact 48-tall bar with logo + search icon + menu icon | 16 | — |

**Half of this closed with C9.** `media.css` now carries a fourth tier, `--tablet (width < 1200px)`, added rather than renamed so the existing `--mobile ⊂ --tablet ⊂ --small-desktop` max-width tiers keep nesting and no shipped rule changed meaning. The header reads them as: side padding 100 → 20 at `--tablet`, nav label 16 → 14 at `--small-desktop`.

Note the two thresholds are **not** the same: the type steps down at 1440, the padding at 1200. That's what the table above says, and it matters — the 1200 tier has the tightest column of all (1000px against a 1240px one at 1440), so it is the width where the nav row runs out of room first.

Still open (A1b): the multiples-of-4 vs multiples-of-5 spacing scale in §2.2.

---

## 3. Component inventory

Status legend: ✅ implemented, ⚠️ partial / drift, ❌ not built (Figma exists, repo missing).

### 3.1 Tokens and primitives

| Figma frame | ID | Status | Notes |
| --- | --- | --- | --- |
| `color` | `1298:5540` | ⚠️ partial | Paint styles wired up; full variable scales (Warning/Danger/Success, brand/red/1-10 numerics) are not. Adopt as needed. |
| `effect` | `1326:310` | ✅ | `--shadow-sm`, `--shadow-lg` wired. `--shadow-lg` is single-layer in code vs two-layer in Figma — minor cosmetic drift. |
| `Typography` | `1320:5044` | ✅ | PT Sans scale aligned to Radix `--font-size-N`. Inter family is orphaned legacy. |
| `icon` (sheets) | `1320:5066`, `1326:6821` | ✅ | **25 SVGs** in `assets/icons/` + typed wrappers in `Icons/` (2026-08-17 count; `download`, `circle-play`, `rutube` and `vk-circle` arrived with D7, then `user`, `phone-call`, `email`, `telegram` and `vk-outline` with `PersonCard` — those five default to `size = 24`, not 20, being the contact-row icons). Some sheet icons (`Bookmark`, `Location Point`, `Internet`) are still not in the repo set. **Exception to the SVG rule:** the three video-platform brand marks are raster image fills in Figma, so they live as 4× PNGs in `assets/images/platform-{vk-video,youtube,rutube}.png` and are wired through `modules/Video/sharePlatforms.ts`. |

### 3.2 Components defined on the `👉 UI` page

Status column reflects the **repo as of 2026-08-13**. Where a shipped component deviates from the Figma spec, the deviation is named rather than hidden.

| Figma component | ID | Variants | Status | Notes |
| --- | --- | --- | --- | --- |
| `Button` (canonical) | `1297:4792` (set) | 3 Variant × 3 Size × 3 State = 27 | ✅ `Button/` | **Geometry confirmed:** `cornerRadius:9999`, fill `#AE0A04` (brand/red/8), padding 12/24, label `text/4/regular` (PT Sans 18). Variants: `Contained`, `Outline`, `white`. Sizes: `Large`, `Small`, `Extra Small`. States: `Default`, `Hover`, `Disabled`. The `white` variant is the donation CTA on the red header. Shipped as a wrapper mapping intent → Radix variant + size (C1). |
| `Links` (text-link buttons) | `1330:36653` (set) | 3 Size × 3 Color × 4 State = 36 | ✅ `Link/` | Aligned in C11. `color` is now `primary \| red \| white` — Figma's three — plus `gray`, kept as a documented extra for `_Breadcrumbs Base` and consent copy. Full matrix below. **Sizes:** Large = 18 (`text/4`), Small = 16 (`text/3`), **Extra Small is byte-identical to Small** in the component set, so the repo keeps the Radix `size` prop (4 → Large, 3 → Small) rather than inventing a third step. No state is underlined. |
| `Button` (legacy) | `1321:5304` (set) | 2 | superseded | Old master with `cornerRadius:5`. Ignore — replaced by `1297:4792`. |
| `_Button Groups Base` (nav) | `1326:17229` (set) | 3 (Default / Hover / Active) | ✅ via `ButtonGroup` | The horizontal nav-link cell. `cornerRadius:6`, padding 10/20, `text/3/regular`, fill transparent (hover/active: `brand/red/6` = `#D83030`). Active adds `text/3/bold`; **hover — and only hover — adds a `brand/red/5` hairline**, and Figma's frame stays 142×42 with it on, i.e. the stroke is drawn *inside*. Ship it as `box-shadow: inset`: a CSS `border` grows the box, which made every cell 2px taller than the spec and the whole bar 131.9 against `header-v2`'s 128. |
| `_Button Groups Base` (tabs) | `1321:5108` (set) | 12 | ✅ `Tabs/` | A different tab cell. `cornerRadius:8`. Two color variants × two sizes × three states. Wraps in a white rounded container (`Frame 33786`). Used in the `page header` block. Shipped **link-based** (each tab a `<NextLink>`, zero client JS) since every confirmed use is URL-driven (C5). **Gap:** the *controlled* client variant needed by the D9 participation-form role tabs isn't built. |
| `Icon Button` | `1327:14092` (set) | 2 Radius × 2 Variant × 3 State = 12 | ✅ `IconButton/` | 32×32, Outline or Contained, three states. **The Radius property is named `Curved (8px)` and every one of the twelve variants is drawn at `cornerRadius:6`** — as is every frame that places one, `header-mob` included. 6 (`radius/2`) is what the repo ships; the name is what's wrong, see §4.3. Circle is `cornerRadius:999`. States, both variants: Outline = white fill / red-8 ring + glyph, hover red-1 fill / red-10 ring + glyph, disabled red-2. Contained = red-8 fill / white glyph, hover red-10, disabled red-2 fill. Shipped as a wrapper (C2); used by the carousel arrows and the mobile header. |
| `Input Field` | `1326:490` (set) | 5 State × 2 Error × 2 Color = 16 (subset realized) | ✅ via `input/` | **Pill input** (`cornerRadius:999`), white fill, gray-4 stroke, padding 10/20/10/15. Optional `Label content` (text/2/regular gray-8) above, optional `Hint message` below, optional Info Outline trailing icon. Two colors: `Default` (gray border) and `White/red` (white on red — used in `header-v2` search). Repo `input/` wrapper supports `color: 'gray' | 'red'` and a trailing icon. **Label, hint message, error state and leading icon are not built** — they shipped once and no call site ever passed them, so they were removed 2026-08-14; both call sites name the field with `aria-label` and validate with native `required`. Rebuild from this row when a form needs one. |
| `Dropdown Menu` | `1324:4234` (set) | 5 | ⚠️ `Dropdown/` | `cornerRadius:6` (not pill — distinct from Input), padding 8/12/8/8, gray-4 stroke, chevron trailing. With label above. **Single-select shipped** on Radix Themes `Select` (C6). **Deferred:** the multi-select + checkbox-list + removable-chip variant from the same set — add when Materials needs it. Not the same thing as the header's `ButtonGroupSubMenu` nav flyout. |
| `_Dropdown List Item` | `1324:15694` (set) | 2 | ✅ | The menu row inside an opened dropdown — realized by Radix's `Select.Item` inside `Dropdown/`. |
| `Checkbox` | `1323:257` (set) | 2 Checked × 3 State × 2 Label = 12 | ✅ `Checkbox/` | 16×16 base, `cornerRadius:4`, gray-4 stroke, white fill. Optional Label slot. Shipped with D1 for the newsletter consent (C7). |
| `Breadcrumbs` | `1321:5894` (set) | 3 (Number of Links = 2/3/4) | ✅ via `Breadcrumbs/` | Existing component covers it. Colours corrected 2026-08-18: the parent links are `#637083` (`--gray-6`, which Radix's `color="gray"` already gave them), **the page's own crumb is `#344051`** (`--gray-8`) and the chevron is the parent's colour, not `--gray-5`. The `Folder` glyph in `_Breadcrumbs Base` is **hidden in every page-header instance** — its bounds sit exactly under the label's, which is Figma's way of reporting an invisible auto-layout child — so the repo is right not to draw one. |
| `header-v2` | `1229:4371` | (component, not set) | ✅ `modules/Header` | Shipped in C9. 1440×128: 12 top → 57-tall logo lockup → 11 → 42-tall nav row → 6. Content column 1240 (`--container-4`) at 100px side padding; top row is the logo against a 505-wide group (320 Input + 8 + Button). Nav row is **space-between across the full column**, not centred — the eight cells measure 1027 in Figma and the remaining 213 spreads at 30.4 a gap. Fill `brand/red/8`, active cell `brand/red/6` + bold. Responsive demos `1620:15285` (1200) and `1620:15287` (900) carry the 14px label and the 20px side padding. |
| `header-mob` | `1248:4486` | component | ✅ `modules/Header` | 360×48: the logo lockup at 0.56×, then two 32×32 Icon Buttons 8 apart, 16 from the edge — the search one is the **Contained** variant (red-8 fill, white glyph) under a white hairline the variant itself doesn't carry, the menu one is plain Outline (white fill, red-8 glyph). Overriding the search fill to `transparent` reads identically on a red-8 bar but swallows the variant's hover, which is how it shipped with no hover at all; add only the ring. Its open state (`1336:10153`, and `1336:10127` with a group expanded) is `MobileMenu`: a white sheet under the bar, 15px side padding, 42-tall rows (`Links`/Small/Primary) each closed by a gray-4 rule, children indented 15 on a 10 gap, the current section in the Active red, and a Small contained Button 25 above and below. |
| `footer` | `838:1631` | component | ✅ `modules/Footer` | 1440×442: 32 top, a 1240 column at 100px side padding, four columns (logo + socials · КОНТАКТЫ РЕДАКЦИИ · ОТЗЫВЫ · ССЫЛКИ), a `gray-6` rule 25 below them, then the legal row 25 under that — three blocks on the same grid, the third under ССЫЛКИ. Fill `gray-9`. Headings `text/3` gray-3, rows `text/3` white on a 5px gap, legal `text/1` gray-4, privacy link `text/2` underlined. **Content still comes from the `sidebar_bottom` widgets** — editors keep owning the links; only the presentation is the component. |
| `footer-1200` · `footer-900` | `1621:15559` · `1621:15660` | frames | ✅ | Undocumented until C9. 1200 keeps four columns and the 100px padding; 900 drops to 20px padding, lifts the logo onto its own row and leaves three columns — which is what `--tablet` switches. |
| `footer-mob` | `1261:7985` | component | ✅ | 360-wide: everything stacks, ОТЗЫВЫ and ССЫЛКИ sit side by side, and the legal blocks go full width on a 24px gap. Identical type sizes to desktop — only the layout changes, so one component covers all four frames. |
| `page header` | `1335:7682` (set, 1 variant) | 1 | ✅ `PageHeader/` | **It's not a hero — it's the entire top-of-page block.** Composition: header-v2 (instance) + breadcrumbs row + page heading "Header" (`text/9/bold` = PT Sans Narrow Bold 48, fill `brand/red/7` `#BE1710`) + tabs row (6 `_Button Groups Base (tabs)` instances inside a 5-padded white rounded wrapper). Shipped as a layout shell: optional `<Breadcrumbs>` + the red uppercase H1 + optional `tabs` slot (C3). The header-v2 instance is **not** re-rendered — that's the global `modules/Header` from the root layout. ~~Note the shipped H1 uses `--red-8` where Figma specs `brand/red/7`.~~ Fixed 2026-08-18, together with the 2% tracking `text/9/bold` carries and `.title` did not: all three now read the tokens (`--red-7`, `--font-size-9`, `--line-height-9`, `--letter-spacing-9`). |
| `Frame 33810` | `1525:15287` (set) | 1 | ? | Adjacent to `page header` in the UI page; unknown role. Worth a glance when D3/D6 starts. |
| `Pagination Web` | `1326:2018` | component | ⚠️ `Pagination/` | Desktop pagination. Figma: 36×36 cells, `cornerRadius:6`. Prev/next chevrons (white fill, gray-2 stroke) flank a center group of number cells (active: brand/red/8 fill + white bold text; idle: white fill + gray-8 text) plus `...` ellipsis. Frame padding 35-top/80-bottom. Shipped link-based, windowed range, zero client JS (C4). **Open deviation:** cells render **40×40 / r8**, measured off the `news` frame's instance, not the component's 36×36 / r6 — Design to arbitrate. |
| `_Paginations Fields Base` | `1326:760` (set) | 10 | ✅ | The cell — 4 Type (Number/Next/Previous/Dots) × variants for state. Realized inside `Pagination/`. |
| `Frame 33811` | `1567:12545` | component | ✅ (by reuse) | Mobile pagination variant — not a separate render; the desktop component flex-shrinks to fit ≤390 with no horizontal overflow (verified). |
| ` Carousel` (frame) | `1326:2019` | — | ✅ `Carousel/` | **Only carousel _chrome_ is designed**, not the slider container — the container is Swiper (C8). Two designed pieces: |
| ↳ `_Carousel Button Base` | `1326:2082` (set) | 2 (Chevron Left / Right) | ✅ | 32×32 circular nav arrows, `cornerRadius:999`, fill `gray-2`, stroke `gray-8` (or the listed `#414E62`), chevron icon inside. Built on the C2 `IconButton` circle variant. |
| ↳ `_Carousel Page Indicator Base/Small/Dot` | `1326:2122` | component | ✅ | 6 8×8 dots, active = `brand/red/7` (`#BE1710`), idle = `gray-5` (`#97A1AF`). |
| `Status` (tracking) | `1350:13908` (set) | 7 (What × Status) | n/a | **Workflow component, not UI.** Tags screens on the `design` page as Design/Text/Dev done/in-progress/not-started. Read it as Design's signal of which mocks are ready. Ignore when building. |

#### The `Links` colour matrix

Read off the component set 2026-08-13. Every cell is text-only — **no state underlines** — and the colour is the only thing that changes across states:

| `color` | Default | Hover | Active | Disabled |
| --- | --- | --- | --- | --- |
| `primary` (Figma `Primary`) | `gray-9` `#202B37` | `red-6` `#D83030` | `red-8` `#AE0A04` | `gray-4` `#CED2DA` |
| `red` | `red-8` `#AE0A04` | `red-10` `#5C0302` | `red-8` `#AE0A04` | `red-3` `#FFB2B2` |
| `white` | `#FFFFFF` | `gray-4` `#CED2DA` | `gray-4` `#CED2DA` | `gray-5` `#97A1AF` |
| `gray` *(repo extra)* | `gray-6` `#637083` | `red-10` | `red-8` | `gray-4` |

Two things this replaced: `lightgrey` (a duplicate of `gray`) and `darkgrey` (`primary` with a red-10 hover instead of Figma's red-6). Each colour is a plain CSS-module class, because `theme-override.css` paints *every* `.rt-Link:hover` red-10 through a `:where()` selector — a single class outranks it.

`primary` is what the header flyout (`1336:10006`), the mobile menu rows (`1336:10032`) and the footer link columns are built from in Figma; they were all on `gray` (`#637083`) before C11.

### 3.3 Repo components not on the `👉 UI` page

| Repo component | Location | What it does |
| --- | --- | --- |
| `Box` | `src/shared/ui/components/Box/` | Responsive layout primitive, nine props (`pt pb py mb gap top display flexDirection position`). Any length: a number is pixels, a string passes through. Each set prop adds one class and one inline custom property. |
| `NewsCard` | `src/shared/ui/components/NewsCard/` | The card primitive that recurs in the home news section, the `/news` grid and the contacts socials grid (`Frame 33827/28/29`). Extracted during D1; lives on the `design` page rather than the `👉 UI` page, which is why it isn't in §3.2. |
| `PersonCard` | `src/shared/ui/components/PersonCard/` | One card for all five people frames on the `design` page — `Frame 33928` (the `handbooks` contact banner, `1584:11717`), the `team-1` grid cards (`1525:14922` &c.), the `team-2` wide cards (`1539:15720`) and the two contacts-page variants. White, radius 12, padding 20, **no border and no shadow in any of them**; name, one gray secondary line, and contact rows of `[24px outline icon] 12 [red 18px link]` on a 6px gap. The only real difference is whether a photo is present, so that is a field (`photo?`), not a prop-selected variant — with it the card is `team-1` (photo 200×259 r12 beside the text, name `text/5/bold` in `--gray-9`), without it the banner (a `User` glyph in the contact indent, name `text/4/bold` in `--red-8`). Data comes from `shared/api/fetchProfile`. **Not built yet:** `team-2`'s full-bleed photo (`padding: 0 20 0 0`, photo→text 40) — the one genuine fork, waiting for that page. |
| `Link` | `src/shared/ui/components/Link/` | Composes Next.js `<Link>` + Radix `<Link>` + the Figma `Links` colour enum (§3.2). |
| `Logo` | `src/shared/ui/components/Logo/` | Brand logo rendered with `logo.webp`. |
| `Modal` | `src/shared/ui/components/Modal/` | Radix `Dialog` under a small API (`isOpen` / `onClose` / `title`). Its content chrome is reset to nothing — the child owns its frame — and it requires a `title`, rendered visually hidden, because a dialog with no accessible name is the one thing Radix can't supply for you. |
| `Accordion` | `src/shared/ui/components/Accordion/` | Wrapper over `@radix-ui/react-accordion` primitive. Used for FAQ. |
| `Icons` | `src/shared/ui/components/Icons/index.tsx` | One line per icon — all the wrapper adds to the svgr component is the square `size` prop. Adding an icon = drop the SVG into `assets/icons/` + one export here (or import the SVG directly, as `Accordion`, `ButtonGroup` and `Breadcrumbs` do, when CSS sizes it). |

---

## 4. Operating notes

### 4.1 When you reach for a new visual primitive

1. Check `src/shared/ui/components/` first.
2. If nothing fits, use Radix Themes / Radix Primitives directly — but if you find yourself styling the Radix component the same way twice, lift it into `src/shared/ui/components/<Name>/`.
3. Never hard-code colors, font sizes, shadows, or line heights — go through the `--*` custom properties. If a value isn't there, add it (and note it here).

### 4.2 When Figma changes

The high-leverage edits are in `theme-override.css`. Every Radix component re-themes automatically:

- **Color change** → update the corresponding `--red-N` / `--gray-N` / `--white` value.
- **New type size** → add `--font-size-N` (and matching `--line-height-N` / `--letter-spacing-N`).
- **Shadow change** → update `--shadow-sm` / `--shadow-lg` directly.
- **Spacing or radius scale change** → both live behind hard-coded numbers in components. There's no central spacing var to flip; updating means editing each call-site. (`Box` no longer constrains the value — it takes whatever the call site writes.)

### 4.3 Open questions to raise with Design (none are blockers)

> The Russian-language version to actually send the designer lives in [`questions-for-designer.md`](./questions-for-designer.md); this list is the engineering shorthand. Keep them in sync — if you resolve one here, strike it there too.

- **Un-tokenized stat accents.** The home StatsRow "+" glyphs use `#42C880` / `#C383D9` / `#FFC33F` / `#6692FD`, which map to no token and to no Figma scale (there is no purple or blue scale at all). The only place in shipped code that violates the never-hard-code-colors rule — see §2.1.
- **`2_main_red` vs `brand/red/8` reds.** Two reds exist in the system (`#F4322A` and `#AE0A04`). Buttons / header / titles use `brand/red/8`. Where is `2_main_red` (`#F4322A`) actually meant to render? If not anywhere, drop the paint style.
- **`1_main_black` for body.** Nothing wires up `#151313` as body text. Confirm Design intended this and add a rule, or drop the style.
- **`4_line_gray` for borders.** Same — unused in the override.
- **Inter typography styles.** Most are orphaned; one place still binds (breadcrumb separator label in `page header`). Confirm cleanup.
- ~~**Spacing scale mismatch.**~~ Resolved on the repo side 2026-08-14: `Box` no longer has a scale, so Figma's multiples of 5 go in as written. Whether Figma should *have* a tighter scale is Design's call, not a blocker here.
- **Single tracking footer column heading style.** Footer uses Inter Regular 15 on one label and PT Sans elsewhere — confirm.
- **The footer's three column headings aren't one colour.** Measured 2026-08-13: КОНТАКТЫ РЕДАКЦИИ and ОТЗЫВЫ are `gray-3` (`#E4E7EC`), ССЫЛКИ is `gray-4` (`#CED2DA`). Shipped as gray-3 for all three, on the assumption the odd one out is a slip.
- **The nav row overflows its own column below 1440** — see [notes §2](./implementation-notes.md#c9-header--footer-promoted-to-the-live-components--2026-08-13). Shipped compressed, wrapping rather than clipping; Design should say what happens when the menu grows.
- **`Icon Button`'s Radius option is named `Curved (8px)` and drawn at 6.** All twelve variants of `1327:14092` carry `cornerRadius:6`, and so does every frame that places one. Repo ships 6 (`radius/2`). Rename the property, or tell us 8 was meant and the variants are stale.
- **The footer's legal notice is a link in WordPress and plain text in Figma.** `838:1512` («Средство массовой информации… Зарегистрировано Роскомнадзором…») is `text/1` gray-4 with no decoration, but the widget wraps part of it in an `<a>`, which the footer underlines like the privacy link. Underline it, or style legal links as plain text?
- **The header search glyph is `gray-1` in `header-v2` and `red-1` in the `Input Field` component.** `1229:4371`'s trailing Search icon strokes `#F9FAFB`; the component's own icons are `#FFEAEA`. Repo follows the component (one shared `.iconRed` rule). Imperceptible on red, but pick one.
- **`Pagination` cell geometry.** Shipped 40×40 / `cornerRadius:8` (measured off the `news` frame's instance) vs the canonical component's 36×36 / `cornerRadius:6`. Which is right?
- **`PageHeader` heading fill.** Figma's `page header` specs `brand/red/7` (`#BE1710`); the shipped H1 uses `--red-8` (`#AE0A04`), matching the other page headings. Confirm which the system means.

### 4.4 What's left to build

The eight primitives this section used to list as "next builds" — `Button`, `IconButton`, `PageHeader`, `Pagination`, `Tabs`, `Dropdown`, `Checkbox`, `Carousel` — **all shipped between 2026-05-30 and 2026-06-04** (C1–C8). What remains, in dependency order:

1. ~~**Promote `header-v2` + `header-mob` to live `modules/Header`** (C9).~~ ✅ **Shipped 2026-08-13.** Three things the measurement turned up that the mocks don't say out loud:
   - **The nav row does not fit below 1440 at Figma's own padding.** Eight WordPress labels plus three chevrons measure 1126px at `padding: 10px 20px` and 16px labels, and the 1200 tier's column is 1000 — Figma's 1200 and 900 frames both overflow their own column rather than solve it. The repo takes Figma's own 14px label under `--small-desktop` *and* drops the horizontal padding to 8px, then lets the row `flex-wrap` as a safety valve, because the labels are editorial: a longer one must fall to a second line, never be clipped. Measured live afterwards: the seven-cell row is 697px against 860 at 900, 951 against 1240 at 1440 — one line at every width.
   - **A Radix prop beats a single-class rule, so double the selector.** That 14px step first shipped as `@media (--small-desktop) { font-size }` inside `.base` and did nothing: `<Text size="3">` puts `.rt-Text:where(.rt-r-size-3)` on the same element, `:where()` counts for nothing, and the Radix sheet loads after the CSS modules. The `padding` in the same block *did* apply, which is exactly what hid it. Same trap on the logo lockup's tracking and leading. `.base.base`, `.logo .name`, `.link.primary` — all three are doubled for this reason.
   - **The search field stays presentational.** `fetchSearch` (B7) exists, a `/search/` route does not, so a submit would only 404.
   - **The mobile drawer closes on a link tap, not on a pathname change.** Deriving `isOpen` from the pathname it was opened at keeps the state out of an effect and handles the back button, but it no-ops for a tap on the row you are already on — which left the sheet up with body scroll locked. A delegated click closes it. The drawer also closes when the viewport widens past 900, or the desktop layout would come back under a white sheet with no button to dismiss it.
2. ~~**Promote `footer` + `footer-mob` to live `modules/Footer`**~~ ✅ **Shipped 2026-08-13**, as part of C9 and **without touching the data path** — the widgets stay the source. Two things it fixed:
   - **The social icons never rendered.** They were `background-image: url(…/vk.svg)` in the module CSS, but `@svgr/webpack` compiles every `.svg` import to a JS module, so the declaration resolved to `vk.svg.<hash>.js` and painted three blank 30px gaps. They are now the typed icon components, swapped in while parsing the widget HTML — which also gives the links an accessible name and removes the last thing in the footer that renders through a CMSMasters class (B8).
   - **The footer logo bypassed the image pipeline**, loading straight off the WordPress origin. It goes through `resolveContentAssets` like every other WP image now.
3. ~~**Align the `Link` wrapper enum** to the Figma `Links` matrix (C11).~~ ✅ **Shipped 2026-08-13** — see the matrix in §3.2.
4. **Add the 4th breakpoint** (A1b) — `media.css` is 3-tier, the design is 4-tier. Affects every responsive component, which is why it's worth doing before more pages land.
5. **`Tabs`, controlled variant** — a client-state sibling for the D9 participation-form role tabs; today's link-based form covers every other use.
6. **`Dropdown`, multi-select variant** — checkbox list + removable chips, needed when Materials filtering lands.
7. **`Accordion`, `Add Circle` expand-icon variant** — D4 contacts and D5 FAQ both use it.
8. ~~**Decide `Modal`'s future.**~~ ✅ **Migrated 2026-08-13 (C10)** — to Radix's Dialog, and with **no new dependency**: `@radix-ui/themes` already ships one, so the primitive package was never needed. The hand-rolled portal kept click-away, Escape and a scroll lock but could not trap focus or take the page behind it out of the accessibility tree; both come free now, and `--color-overlay` in `theme-override.css` carries the 80% scrim the custom overlay painted (Radix defaults to 40%).
   **One thing Radix does not give you for free:** focus *restore*. Its close handler focuses its own `Dialog.Trigger` and `preventDefault()`s the focus-scope restore on the way, unconditionally — so a dialog opened programmatically, with no trigger, drops focus to `<body>`. Callers pass the opening element as `restoreFocusTo`; `ImagePreview` remembers the thumbnail that was clicked.

---

## 5. Reading the Figma file

Useful node IDs (paste after `?node-id=` in the Figma URL):

**`👉 UI` page**
- Page root — `1297:4635`
- color — `1298:5540` · effect — `1326:310` · Typography — `1320:5044` · icon sheets — `1320:5066`, `1326:6821`
- button (canonical) — `1300:4731` (frame), `1297:4792` (set) · button (legacy) — `1321:5303`
- icon-button — `1327:14974` (frame), `1327:14092` (set)
- button-groups (nav) — `1326:16966` (frame), `1326:17229` (set)
- tabs — `1321:4794` (frame), `1321:5108` (set)
- input — `1321:5552` (frame), `1326:490` (set)
- dropdown — `1321:5794` (frame), `1324:4234` (set)
- checkbox — `1321:6119` (frame), `1323:257` (set)
- breadcrumbs — `1321:5852` (frame), `1321:5894` (set)
- navigation — `1327:13588` (frame, contains responsive demos at 1440/1200/900)
- header-v2 — `1229:4371` (component) · header-mob — `1248:4486` (component)
- footer — `838:1631` (component) · footer-mob — `1261:7985` (component)
- page header — `1335:7813` (frame), `1335:7682` (set)
- pagination — `1321:5809` (frame), `1326:2018` (Web component), `1326:760` (cell set), `1567:12545` (mob)
- Carousel — `1326:2019` (frame), `1326:2082` (button set), `1326:2122` (indicator)
- Links — `1330:36653` (set)
- Status (tracking) — `1350:13908` (set)

**`design` page (mocks live here — see [`page-mocks.md`](./page-mocks.md))** — page id `168:717`.
