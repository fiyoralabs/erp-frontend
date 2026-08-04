# Fiyora ERP Frontend — Architecture

**Status:** Foundation phase. This document is the source of truth for technical decisions. Read this + `IMPLEMENTATION_PLAN.md` before resuming work in a new session — they're kept up to date as each module lands, specifically so work can be picked up after a context reset without re-deriving these decisions.

**Backend being integrated:** `erp` (Spring Boot, `http://localhost:8080`, 209 REST endpoints across 10 modules — Auth, Master, Product, Inventory, Purchase, Sales, Expense, Finance, Report, Audit). Full endpoint inventory: `../verification-reports/02_CODEBASE_INVENTORY_REPORT.md` and `../verification-reports/08_API_TEST_REPORT.md` in the sibling `erp` repo's audit output — treat those as the API contract reference, cross-checked against live `curl` calls before wiring up any screen (see "API-first workflow" below).

---

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), already scaffolded | Given |
| Language | TypeScript, strict mode | Given, type safety across 209 endpoints' worth of DTOs matters a lot here |
| Styling | Tailwind CSS v4 (already installed) | Utility-first, fastest path to consistent responsive design across dozens of screens |
| Components | shadcn/ui (Radix primitives + Tailwind, copied into the repo, not an npm dependency) | Accessible, composable (Dialog/Table/Select/Form/Sheet/etc.), no heavy opinionated design system fighting Tailwind, and every component is local source we can adapt — critical for an app this size where we'll need the same Table/Form/Dialog pattern hundreds of times |
| Server state / data fetching | TanStack Query v5 | Every screen is backend-CRUD. Query handles caching, refetch-on-mutation, loading/error states, and pagination consistently instead of hand-rolling `useEffect` fetch logic 200 times |
| Forms | react-hook-form + zod | Pairs with shadcn/ui's Form primitives; zod schemas double as a lightweight, checkable contract against each endpoint's request DTO |
| Auth | httpOnly cookie holding the erp JWT, set by a Next.js Route Handler — never stored in `localStorage`/client JS | Matches the proven pattern already used by `fiyora-platform-next` (`lib/backend-client.ts`) elsewhere in this ecosystem; avoids XSS-exposed token storage |
| Backend calls | A single catch-all proxy Route Handler (`app/api/proxy/[...path]/route.ts`) forwards any method/path to `erp`, attaching `Authorization: Bearer <jwt-from-cookie>` server-side | With 209 endpoints, hand-writing a dedicated Route Handler per endpoint (`fiyora-platform-next`'s pattern, viable at ~16 endpoints) doesn't scale. The browser only ever talks to erp-frontend's own origin — CORS never enters the picture, and the JWT never reaches client JS. |
| Icons | lucide-react | shadcn/ui's default, consistent icon set |

## 2. Why the proxy pattern, specifically

- Browser → `erp-frontend` (same origin, e.g. `http://localhost:3001`) → Next.js server → `erp` (`http://localhost:8080`). No CORS configuration needed on either side beyond what already exists.
- The httpOnly cookie is set once at login (`/api/auth/login`) and read server-side by the proxy handler on every subsequent call — client code never touches the raw JWT.
- `erp`'s `JwtFilter` already revalidates user/company/permission state on every request (confirmed in the production-readiness audit), so there's no meaningful security loss from centralizing the token attach point in one proxy handler versus one-per-endpoint.
- Refresh-token rotation (erp's `/api/v1/auth/refresh-token`) is handled centrally in the proxy: on a `401` from erp, the proxy attempts one silent refresh using the refresh-token cookie, retries the original request once, and only then surfaces the 401 to the client. This means individual screens never need to think about token expiry.

## 3. Directory structure

```
erp-frontend/
  ARCHITECTURE.md              <- this file
  IMPLEMENTATION_PLAN.md        <- module-by-module checklist, the resumption point
  app/
    api/
      auth/
        login/route.ts          <- POST erp /api/v1/auth/login, sets httpOnly cookies
        logout/route.ts         <- clears cookies
        refresh/route.ts        <- POST erp /api/v1/auth/refresh-token
        me/route.ts             <- reads cookie, returns current user shape for client hydration
      backend/
        [...path]/route.ts      <- catch-all authenticated forwarder to erp (named "backend", not
                                    "proxy", to avoid clashing in name with Next's own proxy.ts convention below)
    (auth)/
      login/page.tsx
      forgot-password/page.tsx
    (dashboard)/                <- authenticated app shell (sidebar+topbar layout)
      layout.tsx
      dashboard/page.tsx
      master/                   <- Locations, Categories, Brands, Units, Taxes, Payment Methods, Reasons, Customer Groups, Document Sequences
      products/
      inventory/
      purchases/
      sales/
      expenses/
      finance/
      reports/
      audit/
      settings/                 <- users, roles, api keys, sessions (auth module's non-login endpoints)
  components/
    ui/                          <- shadcn/ui primitives (generated, not hand-written)
    layout/                      <- Sidebar, Topbar, MobileNav, PageHeader
    data-table/                  <- shared paginated/sortable table wrapper (used by every module)
    form/                        <- shared form field wrappers
  lib/
    api-client.ts                 <- typed fetch wrapper client components call (hits /api/backend/*)
    query-keys.ts                 <- centralized TanStack Query key factory, one section per module
    auth.ts                       <- server-side cookie helpers (get/set/clear JWT + refresh token)
    dal.ts                        <- verifySession() Data Access Layer, per Next's own recommended auth pattern (cached per request via React's cache())
    types/                        <- one file per module, hand-written from the real API responses (curl-verified, not assumed)
    validation/                   <- zod schemas, one file per module
  proxy.ts                        <- Next.js 16 renamed "middleware" to "proxy" (functionally identical). Optimistic
                                      redirect only (reads the cookie, does not call erp) -- the real enforcement is
                                      the DAL (lib/dal.ts) plus erp's own JwtFilter revalidating every request.
```

## 4. API-first workflow (per the explicit instruction to verify before integrating)

For every endpoint, before any UI code is written against it:
1. `curl` the real endpoint against the running `erp` instance (`localhost:8080`) with a real JWT, covering the happy path and at least one validation-error case.
2. Record the *actual* request/response shape observed (not the Swagger-documented one — the production-readiness audit found several places where they disagree) into `lib/types/<module>.ts` as the TypeScript type.
3. Only then wire up the screen against that verified type.
4. If the curl call reveals a backend bug (matching the audit's findings, e.g. an undocumented required field, a wrong status code), note it in `IMPLEMENTATION_PLAN.md` under that module's "Backend issues found" list rather than silently working around it in the frontend.

## 5. Responsive design rules

- Mobile-first Tailwind breakpoints (`sm`/`md`/`lg`/`xl`) — base styles target phone width, breakpoints add desktop layout.
- Sidebar: full-height fixed sidebar at `lg:` and above; collapses to a slide-over `Sheet` triggered by a hamburger button below `lg`.
- Data tables: the shared `DataTable` component renders as an actual `<table>` at `md:` and above, and as a stacked card-per-row list below `md` — wide tables (Sales invoices, Purchase orders, etc.) are unusable as literal tables on a phone screen, so this switch is mandatory, not optional polish.
- Forms: single-column at all widths below `md`, two-column grid at `md:` and above where the form has enough fields to warrant it.
- Every interactive target (buttons, table row actions) sized for touch (minimum 44x44px hit area) regardless of viewport, not just on mobile breakpoints.

## 6. Module build order (rationale, detail in IMPLEMENTATION_PLAN.md)

Auth → Dashboard shell → Master data → Product → Inventory → Purchase → Sales → Expense → Finance → Report → Audit → Settings (Users/Roles/API Keys/Sessions).

This mirrors erp's own dependency graph (confirmed in the production-readiness audit's architecture review): Master has no dependencies, Product depends only on Master, Inventory/Purchase/Sales depend on Product+Master, Expense/Finance/Report are consumers of the rest. Building the frontend in dependency order means every module's screens can use real data created by the previously-built module's screens for testing, instead of needing seed scripts.

## 7. Known backend constraints this frontend must work around

(From the production-readiness audit and its subsequent fix pass — re-verify each still holds before relying on it, backend code may keep changing.)
- Several endpoints require fields not obvious from naming (e.g. Unit creation requires `symbol`; OTP verification requires `purpose`; Product creation currently requires client-supplied `companyId` despite the architecture doc saying otherwise) — each module's `lib/types/` file must document these explicitly as comments, not just silently include them.
- Not every module has full CRUD parity — e.g. Purchase's REST surface is create-and-narrow-read only (no list/search for Suppliers, POs, GRNs, Invoices as of the audit) — the frontend can't build a "list all purchase orders" screen against an endpoint that doesn't exist; check the live endpoint inventory per module before designing a screen around it.
- Report module is 100% read-only, no export endpoints confirmed working as of the audit — don't build export buttons until independently curl-verified.
- Several modules have no "list all" endpoint for a sub-resource even though create/update/delete exist by id -- confirmed for Product's Images and Barcodes (no GET at all) and Product Prices (only current-price-by-combo + history-by-id, no list-all-prices-for-product). Don't assume a list endpoint exists; check the controller source before designing a screen around one.

### Product variants, pricing, and barcode rules (implemented 2026-08-03)

- Category attributes are structured data: `master.category_attribute` + ordered options, assigned through `category_attribute_mapping`. Variant values live in `product.product_attribute_value`; do not encode Color/Storage solely into a free-text variant name.
- Every variant combination is unique within a product. The backend generates its display name from ordered values (for example `Red / 128GB`) while SKU remains company-unique.
- Product prices are scoped by `product + optional variant + price list + effective period`; they are **not duplicated per location**. A location's allowed/default price lists are managed by `master.location_price_list`. Each variant may have a different cost, selling price, and MRP in the same price list.
- Every active location must have at least one active price list and exactly one default. Creation saves the location, configuration, and assignments atomically; reassignment cannot leave the location without a default.
- Retail barcodes identify a sellable SKU: simple-product barcode for a simple product, variant barcode for a variant product. Identical physical units share that barcode. Batches use `inventory.stock_batch.batch_number`; unique physical-device identity (IMEI/serial) is a separate future serial-tracking concern. Internal generated barcodes are permanent CODE128 values derived from company/category/product/variant identity; manufacturer EAN/UPC values remain manually supplied.

## 8. Base UI gotchas (this preset's primitive library) -- check this list before debugging a new one from scratch

This app's shadcn preset (`base-nova`) is built on `@base-ui/react`, not Radix -- most shadcn knowledge from training data/memory assumes Radix and will lead you wrong here. Every one of these was found live (real console error or thrown exception), not theoretical:

- **No `asChild` prop.** Radix's `asChild` pattern is `render` here: `<Trigger render={<Button/>} />`, not `<Trigger asChild><Button/></Trigger>`.
- **`nativeButton` on `Button`/`Menu.Trigger`/etc.** defaults to `true`, which asserts (console error, dev-only) that the final rendered DOM node is a literal `<button>`. Composing `render={<Link/>}` (an `<a>`) onto a component that defaults `nativeButton=true` trips this -- pass `nativeButton={false}` explicitly when the rendered element is intentionally not a button (e.g. a styled navigation link). `Menu.Item`/`Menu.CheckboxItem`/etc. default `nativeButton=false` already, so this mainly bites `Button` and `Menu.Trigger`/`Dialog.Close`-style triggers.
- **`Menu.GroupLabel` (`DropdownMenuLabel`) throws** `"MenuGroupContext is missing"` -- an actual uncaught `Error`, not a console warning -- unless wrapped in `Menu.Group` (`DropdownMenuGroup`). Same for `Menu.RadioGroup`-only parts.
- **`Select.Value` shows the raw value, not the label**, unless `Select.Root` is given an `items` map (`Record<string, ReactNode>` of value→label, or an array of `{value,label}`). Every id-valued Select (category/unit/brand/tax/location/parent pickers, anywhere `value` ≠ what should display) needs this -- confirmed live: without it the trigger showed the bare numeric id after selecting. `components/ui/select.tsx`'s wrapper doesn't set a default; every call site must pass `items` itself.
- **`Combobox.Root`'s built-in filter is unreliable for plain free-text string fields** (city/currency/timezone-style inputs with no real "selected value" object) -- its single-selection filter path depends on Root's own uncontrolled selected-value concept, which doesn't apply here, and it was observed live marking the list `data-list-empty` even on an exact match. `components/shared/combobox-field.tsx` disables it (`filter={null}`) and does its own case-insensitive filtering instead -- don't remove that without re-verifying in a real browser first.
- **`FormLabel`/`FormControl` (this repo's hand-written `components/ui/form.tsx`, not shadcn's default) throw** `"useFormField should be used within <FormField>"` if used outside a `FormField` render callback -- e.g. a static read-only field in a form. Use the plain `Label`/`Input` for those, not the Form-wrapped versions.
- **`Dialog`/`Sheet` content has no max-height by default** -- `components/ui/dialog.tsx`'s `DialogContent` was fixed to `max-h-[85vh] overflow-y-auto`; if a new dialog variant is added, carry that forward or a tall form becomes unreachable/unscrollable below the fold.

### Restarting `erp` locally (needed after any backend code change)

`erp` requires `JWT_SECRET` and `DB_PASSWORD` env vars with **no fallback default** in `application.properties`/`application-local.properties` (unlike `fiyora-platform`, which has dev-friendly `${VAR:default}` fallbacks) -- starting it with neither set fails immediately (`Could not resolve placeholder 'JWT_SECRET'`). As of 2026-08-03:
- `DB_PASSWORD=root` (same local Postgres instance fiyora-platform uses, confirmed via direct `psql` connection).
- `JWT_SECRET` has no recoverable original value -- if erp needs restarting, generate a fresh one and export it alongside `DB_PASSWORD` before `mvn spring-boot:run`. **This invalidates every existing logged-in session** (any previously-issued JWT fails validation against the new secret) -- expected, not a bug; just re-login afterward. Consider adding a persistent local env file (outside version control) so this stops being a recurring rediscovery.
