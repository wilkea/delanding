@AGENTS.md

# delanding — Depad storefront

Storefront and admin UI for Depad, a mousepad store moving off Shopify. Landing, catalog, cart, checkout, and `/admin`. All data and business logic live in the .NET API in `../deserver`; this app only talks to it over HTTP.

## Owner context

- Solo developer, strong in .NET, new to React/Next.js. Explain the *why* and *how* of changes in the reply, especially React/Next.js concepts (server vs client components, data fetching, caching).
- No code comments unless something is genuinely non-obvious. Explanations go in the reply.
- Prefer the standard Next.js way over extra libraries. Add a dependency only when it clearly earns its place.

## Stack

- Next.js 16 (App Router, `src/` dir), React 19, TypeScript, Tailwind CSS v4, ESLint.
- Import alias `@/*` → `src/*`.
- Server-rendered pages by default (SEO matters for a store). Use `"use client"` only where interactivity needs it.

## Conventions

- No business logic here: prices, stock, order rules come from the API.
- API base URL from env (`NEXT_PUBLIC_API_URL` / server-side equivalent) in `.env.local`, never hardcoded.
- API types generated from the backend's OpenAPI spec, not hand-written.
- Admin auth uses the API's cookie; no auth logic duplicated here.

## Commands

```bash
npm run dev
npm run build
npm run lint
```

Dev server: http://localhost:3000

## MCP

- `context7` — current docs for Next.js 16, React 19, Tailwind v4. Use it (and `node_modules/next/dist/docs/`) before relying on memory.
