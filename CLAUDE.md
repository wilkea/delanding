@AGENTS.md

# delanding — Depad storefront and admin

Storefront and admin UI for Depad, a peripherals store moving off Shopify. Landing, catalog, cart, checkout, and `/admin`. All data and business logic live in the .NET API in `../deserver`; this app only talks to it over HTTP.

## Owner context

- Solo developer, strong in .NET, new to React/Next.js. Explain the *why* and *how* of changes in the reply, especially React/Next.js concepts (server vs client components, data fetching, caching).
- No code comments unless something is genuinely non-obvious. Explanations go in the reply.
- Prefer the standard Next.js way over extra libraries. Add a dependency only when it clearly earns its place.
- The current shop design (`docs/design/`) is a reference, not a spec — make better design decisions where clear and point them out.
- Work on a branch, leave changes uncommitted, commit only when the owner says so. Scenarios in `docs/scenarios/` are written and agreed before code.

## Stack

- Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind CSS v4, ESLint. Middleware is called **proxy** in Next 16 (`src/proxy.ts`).
- **shadcn/ui** (style `base-nova`, built on Base UI): components in `src/components/ui/`, added with `npx shadcn@latest add <name>`. Base UI triggers take a `render` prop instead of `asChild`.
- **TanStack Query** for server data, **react-hook-form + zod** for forms, **sonner** toasts, **lucide-react** icons.
- **next-intl** texts in `messages/en.json` via a client provider (`src/components/intl-provider.tsx`). No next-intl plugin: it pulls `@swc/core`, whose native binding fails in the sandbox.
- Fonts: Inter (UI, `font-sans`) and Kanit (brand headings, `font-heading`). Primary color `#984AFE`.

## API

- The browser calls `/api/*` and `/media/*` on this app; `next.config.ts` rewrites them to `BACKEND_URL` (default `http://localhost:5181`). Same origin, so the backend's `depad_auth` cookie just works.
- Typed client: `src/lib/api/client.ts` (`api.GET/POST…` from openapi-fetch, `call()` throws `ApiError` with `fieldErrors`). Types in `src/lib/api/schema.d.ts` are **generated** — never edit; run `npm run api:types` with the backend running.
- A 401 outside the login sends the browser to `/admin/login?expired=1&returnTo=…`.
- **Every failed save must say why, visibly.** Every admin form uses `useServerErrors(form.setError, labels)` + `<ServerErrors />` (`src/components/admin/server-errors.tsx`): it marks the named fields *and* lists every backend message above the Save button, so no message is ever lost because the screen has no matching field. Submit with `submitWith(form, handler)`, never `form.handleSubmit` directly: React Hook Form silently refuses to submit while an old server error sits on a field without an input. Failed deletes and other one-click actions use `useNotify().failed` (toast). Never swallow an error silently. E2E tests for refusals assert the message text.

## Admin

- `src/app/admin/login` — login. `src/app/admin/(panel)/` — everything behind login, wrapped by `admin-shell.tsx` (sidebar + mobile sheet). New sections: add a page under `(panel)` and an entry in `navigation` in `admin-shell.tsx`.
- `src/proxy.ts` redirects to login when the auth cookie is missing (optimistic check); the API is the real guard.

## Commands

```bash
npm run dev          # http://localhost:3000 (backend must run on :5181)
npm run build
npm run lint
npm run api:types    # regenerate API types from the running backend
npm run test:e2e     # Playwright; needs backend + E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
```

## MCP

- `context7` — current docs for Next.js 16, React 19, Tailwind v4. Use it (and `node_modules/next/dist/docs/`) before relying on memory.
