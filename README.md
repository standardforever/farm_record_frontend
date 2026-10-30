# Oko — web app

The web app for **Oko**, the livestock ecosystem for Nigeria: farms, vets, suppliers, buyers, lenders and programmes working from one set of records.

| | |
|---|---|
| Live app | https://oko-livestock.vercel.app (every push to `main` deploys) |
| API | https://oko-api.onrender.com (repo: [farm_record_backend](https://github.com/standardforever/farm_record_backend)) |
| Roadmap | [farm_record_backend/docs/ROADMAP.md](https://github.com/standardforever/farm_record_backend/blob/main/docs/ROADMAP.md) and the GitHub milestones |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query · react-hook-form + zod · lucide icons.

## Run it locally

```bash
cp .env.example .env.local     # BACKEND_URL=http://localhost:8000
npm install
npm run dev                    # http://localhost:3000
```

Start the backend first (see its README). The app calls `/api/v1/...` on its own origin and Next.js forwards those calls to `BACKEND_URL`, so the login cookie stays first-party and there is no CORS to configure locally.

Before you push: `npm run check` (lint, typecheck and build).

## How the code is laid out

```
src/
  app/                 Routes only. Each page is thin and composes features.
    (auth)/            login, register
    invite/[token]/    accept an invite
    onboarding/        create the first workspace
    w/[orgId]/         everything inside a workspace (home, team, audit, settings, modules/…)
    admin/             Oko staff console
  features/<module>/   One folder per backend module: api.ts (queries and mutations),
                       its components, and an index.ts that is the only public entry.
  components/ui/       Design-system primitives (Button, Field, Dialog, Card, Badge…)
  components/layout/   App shell: sidebar, phone header and bottom bar
  config/navigation.ts Navigation registry
  lib/                 api client, types, formatting helpers
```

Rules that keep contributions from colliding:

1. **A feature never imports another feature's internals.** Import from `@/features/<name>` (its `index.ts`). ESLint enforces this.
2. **Screens register in `config/navigation.ts`** with the permission (and plan feature) they need. The menu hides what a person cannot use; wrap the page in `<RequirePermission>` so a typed URL is refused too.
3. **All server calls go through `lib/api.ts`.** It attaches the token, refreshes it once on expiry and turns errors into `ApiError` with the backend's message.
4. **Colours come from tokens** in `app/globals.css` (`bg-surface`, `text-ink-2`, `bg-brand`…). Never hard-code a hex value in a component; light and dark mode then work for free.

See [CONTRIBUTING.md](CONTRIBUTING.md) for adding a module screen step by step.

## Deployment

Vercel builds every push to `main` (preview builds for pull requests). The only setting is the environment variable `BACKEND_URL`, set to the Render API URL.
