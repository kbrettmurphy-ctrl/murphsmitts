# CLAUDE.md — Murph's Mitts / MurphOS

Admin system for Murph's Mitt Maintenance (baseball glove cleaning, conditioning,
relacing, ShockTec Air2Gel palm pads — local drop-off and shipped orders).
Owner/operator: Brett Murphy. Solo business. This repo is both the public site
and the admin portal ("MurphOS").

## Stack

- Static/Jekyll-style public site (repo root: `index.html`, `services/`, `gallery/`, etc.)
- Admin portal: `/admin` — `admin/index.html`, `admin/admin.js` (single file, ~13k+ lines), `admin/admin.css`
- API: Cloudflare Pages Functions in `functions/api/` (`orders.js`, `lace-inventory.js`, `gloves-for-sale.js`, `intake.js`, `sms-reply.js`, `track.js`, plus `_webpush.js` support code)
- Database/storage: Supabase (REST via `supabaseFetch`; migrations in `supabase/migrations/`)
- Deploys: Cloudflare Pages. `main` = production. Feature branches get preview URLs:
  `https://<branch>.murphsmitts.pages.dev/admin/`

## Working rules (non-negotiable)

- Make narrow, surgical changes. Do not redesign unrelated areas. Do not "modernize" the repo.
- Do not change the public site unless explicitly requested.
- No global CSS changes — scoped selectors only, appended in clearly-commented blocks.
- Admin header subtitles are standardized by `.topbar .topbar-subtitle`. Keep each
  unique `#...Count` ID only as a JavaScript/data hook; never style header subtitles
  with page-specific ID selectors or add another ID to a CSS allowlist.
- Every new admin `<button>` must use an existing standardized button class; never
  leave a button unclassified for browser-native styling. Adjacent peer actions must
  share the same base button class unless an intentional semantic distinction is
  documented and visually verified on desktop and mobile.
- Preserve existing behavior unless directly told otherwise.
- Inspect the relevant files before changing them. Line numbers drift; trust names.
- If asked for a small fix, do not change 47 unrelated things.
- Never expose or commit secrets. Auth uses `validateTokenFromBody(body, env.ADMIN_SESSION_SECRET)`.

## Fragile areas — do not touch unless the task directly requires it

- Orders workflow sheet + attached submenus (positioning/width especially)
- Order/inventory filter popovers; the finance filter popover
- Lace Inventory submenus and the alert checkbox/toggle
- Gloves For Sale photo role selects
- Mobile Order Detail containment
- Map: routing, zoom, geocoding, Show on Map
- Order save behavior (`saveOrderUpdate`, the Order Detail save form)
- Email/SMS status delivery behavior
- Activity logging (`logOrderActivity`) — don't add/remove events unless asked
- Swipe actions on order cards
- Known hazard: re-rendering the dashboard from an outside-click/document-level handler
  destroys focused finance custom date inputs (kills the native iOS date picker).
  There are code comments about this — respect them.

## Style preferences

- Compact admin controls; iOS/macOS-ish feel; laptop/iPad friendly.
- No horizontal page overflow on mobile, ever (scroll inside a table wrapper is OK).
- Match existing visual language: `.dashboard-card`, 32px-min-height buttons,
  `border-radius:10px`, `rgba(9,47,77,...)` navy palette, `#fffaf3` surfaces.

### BUTTONS ARE STANDARDIZED — NO BIG BUTTONS. EVER. (read this every time)

Every button MUST match the compact size of its siblings. A button taller/fatter
than the ones next to it is a bug — fix it before shipping, desktop AND mobile.

`button.secondary` is THE secondary-action button and its base is COMPACT on
EVERY screen: `min-height:32px; padding:4px 12px; font-size:.8rem`. So to add an
action button: give it `class="secondary"` and it is automatically compact and
uniform with every other secondary button (Resend, Status Link, combined-bill,
"Use", etc.). Do NOT invent a new button class or add a per-button size override
— you'll drift out of sync.

**Size AND font-size live in the BASE rule, not only in a media query.** This is
the exact bug that keeps recurring, so internalize it:
- The base `button.secondary` must carry `min-height`, `padding`, AND
  `font-size`. If font-size only lives in `@media (min-width:900px)`, then on
  MOBILE the button inherits the big body text, grows wide, and wraps to a new
  row. (This bit us: the Resend/Status Link row wrapped on iPhone.)
- Never bump `button.secondary` padding or font-size; never add a button padding
  > ~4–6px vertical.
- Never remove a button's size/font override without first checking mobile —
  if it was the only thing keeping the text small on mobile, removing it
  re-breaks it.
- (History, three times burned: base was once `padding:12px 14px` — fat; then a
  parent-scoped compact override missed buttons of the same class in other
  containers; then font-size lived only in the desktop media query and mobile
  went big. All three are gone now because the base is fully compact — keep it
  that way.)

Before shipping ANY button: render it next to its siblings headless and confirm
identical height AND font-size at desktop (≥900px) AND mobile (≤899px, e.g. 390px
wide). This applies no matter which model/agent is doing the work.

## Architecture map

The current as-built system is documented in `.docs/ARCHITECTURE.md`, `.docs/FEATURE_INVENTORY.md`, `.docs/DATABASE.md`, `.docs/WORKFLOW.md`, and `.docs/DEPLOYMENT.md`. Ranked risks are in `.docs/TECHNICAL_DEBT.md`.

**admin/admin.js** — everything client-side. Key regions (search by name):
- `postJson(body, useAuth)` — all API calls, action-based bodies
- Views: `showView` element list, `normalizeAdminView`, `getViewTitle`, `setActiveView`;
  nav buttons in `admin/index.html` (`.nav-link[data-view]`)
- Clubhouse dashboard: `renderHomeDashboard`, `renderDashboardOrderRow/List`,
  `wireHomeDashboardActions` (single delegated click listener on `dashboardPanel`),
  `getBenchPreviewOrders`, `getOnDeckOrders`; labor state in `dashboardLaborSessions`
- Bench Focus: server state in `benchFocusState`; `refreshBenchFocusState`,
  `renderBenchFocusCard`, `startBenchWorkFromDashboard`, and unresolved reconciliation.
  Bench elapsed is never official labor; database RPCs own cross-table transitions.
- Orders list: `renderOrderRow`-style card rendering, swipe actions, ••• menu
  (`toggleDesktopOrderActionMenu`), workflow sheet (`openWorkflowSheet(order, event)` —
  global + order-agnostic, right-click/long-press to open)
- Order Detail: collapsible sections via `renderCollapsibleDetailSection`;
  Labor Timer (`renderLaborTimerPanel`, `loadLaborSessions`, pause/resume/stop);
  Economics card (`getOrderEconomics`, `getOrderMaterialsCost`, `getSuggestedPrice`)
- Money view: `renderMoneyView`, aggregates `listLaborSummary`
- Business constants: `SHOP_ECONOMICS` (lace $3.60/piece; piece defaults Fielders 3
  [+1 trapeze/mod-trapeze], Catchers 4, First Base 5; palm pad $1.25; consumables $1)
  and `SHOP_PRICING` (relace $80/$100 tiers, +$20 palm pad). Shipping is pass-through —
  excluded from all economics math.
- Effective rate = (priceQuoted − materials) ÷ logged labor hours. Only stopped
  labor sessions count. Never show NaN/Infinity.

**functions/api/orders.js** — action dispatch: `if (action === "...")` blocks, each
auth-validated, each returns `json({ ok, ... }, 200, jsonHeaders)` (errors are
`{ ok:false, error }` with HTTP 200). Order mapping: `mapOrderFromDb` (snake→camel)
and a whitelist-style updates mapper (`if ("field" in updates) out.db_col = ...`).
Labor sessions table: `public.order_labor_sessions` (status running/paused/stopped,
`pause_accumulated_seconds`; elapsed excludes paused time).

**Supabase migrations** — additive only. `add column if not exists`, backfill with
`update ... where ... is null`, guarded constraints. Never drop/rewrite data. Never
run `supabase db push` or `supabase db reset` — the owner reviews and pushes
migrations himself.

## Checks & workflow (every task)

Branch from updated `main`: `git checkout main && git pull && git checkout -b <feature-branch>`.

Before finishing:
```
node --check admin/admin.js
node --check functions/api/orders.js   # if touched
node scripts/action-dispatch-selftest.mjs  # dispatcher/auth characterization
node scripts/pricing-selftest.mjs
node scripts/bench-focus-selftest.mjs
git diff --check
git status --short
```

Commit scoped files only; push the feature branch; never commit directly to `main`.

## Final report format (every task)

- Files changed
- Migration added (path + columns) if any
- API actions added/changed if any
- UI behavior added/changed
- What was intentionally not touched
- Commands/checks run and results
- Manual testing still needed (list concrete steps; always include: no mobile
  horizontal scroll, order save works, workflow menus work, timer works,
  Clubhouse/Finance Snapshot unchanged)
