# Contributing to the Oko web app

Thank you for helping. Work is planned in GitHub milestones (one per roadmap step, for example **M1.1 · Farm units**). Pick an open issue labelled `good first issue` or one in the current milestone, comment that you are taking it, and open a pull request against `main`.

## Adding screens for a new module

Say the backend has just shipped the `health` module.

1. **Create the feature folder** `src/features/health/`:
   - `api.ts` — TanStack Query hooks that call `get`/`post`/… from `@/lib/api`. Query keys start with the module name and org id: `["health", orgId, …]`.
   - components the module needs (`VaccinationDialog.tsx`, …).
   - `index.ts` exporting only what pages use.
2. **Add types** for the API responses in `src/lib/types.ts` (or `features/health/types.ts` if only that module uses them).
3. **Add the pages** under `src/app/w/[orgId]/health/`. Keep them thin; wrap each in
   `<RequirePermission permission="health.view">`.
4. **Register the screen** in `src/config/navigation.ts`:
   ```ts
   { key: "health", label: "Health", path: "/health", icon: Syringe, permission: "health.view", group: "Workspace", mobile: true },
   ```
   Once the backend marks the module live, it leaves the "Coming next" list on its own.
5. Run `npm run check`.

Nothing outside your feature folder, its pages and one navigation line should change. If you need a new shared primitive, add it to `components/ui/` in a separate pull request.

## Style

- Plain words in the interface. Write for a farm manager reading on a phone: "Invite someone", not "Provision user".
- Every screen works at 360px wide. Test the phone layout before opening a PR.
- Use tokens (`text-ink-3`, `bg-brand-soft`) not raw colours, and lucide icons.
- Show loading, empty and error states. Use `<EmptyState>`, `<PageLoader>` and `<Alert>`.
- Hide actions a person's role cannot take (`ws.can("invites.manage")`); the backend refuses them anyway.

## Pull requests

- One module or one fix per PR.
- Fill in the template, link the issue (`Closes #12`) and add phone and desktop screenshots for UI changes.
- CI runs lint, typecheck and build. It must be green to merge.
