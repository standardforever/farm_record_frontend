## What this changes

<!-- One or two sentences. Link the issue: Closes #123 -->

## Module and milestone

- Module: <!-- e.g. team, health -->
- Milestone: <!-- e.g. M1.4 · Health and vaccines -->

## Screenshots

<!-- Phone (360–390px) and desktop, for any UI change -->

## Checklist

- [ ] Code lives in `src/features/<module>/` and its pages; no deep imports into other features
- [ ] New screens are registered in `src/config/navigation.ts` and wrapped in `<RequirePermission>`
- [ ] Loading, empty and error states are handled
- [ ] Works at phone width, in light and dark mode
- [ ] `npm run check` passes
