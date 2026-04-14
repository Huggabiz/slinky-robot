# CLAUDE.md

Project-specific guidance for Claude Code sessions on this repo.

## Versioning

- **Always bump `package.json` `version` before every commit.** Default to a
  patch bump. Minor/major only when the user explicitly asks or the change
  warrants it. The user expects a bump on every commit, including config/docs
  changes, so they can tell from the toolbar badge which build is live.
- The app displays `APP_VERSION` in the toolbar, sourced from `package.json`
  via Vite's `define` in `vite.config.ts`. A bump is the only way the user
  can tell a new build is live.

## Branching & Deploy

- Feature work happens on `claude/<session-slug>` (per session instructions).
- **GitHub Pages only deploys from `main`** (see `.github/workflows/deploy.yml`).
  Pushing to the feature branch alone will NOT update what the user sees on
  refresh.
- After pushing completed work to the feature branch, fast-forward `main`
  so the deploy fires:
  ```
  git push origin <feature-branch>:main
  ```
- Only do this for work the user has signed off on.

## Build / Verify

- `npm run build` runs `tsc -b && vite build`. Run it before committing to
  catch type errors and confirm the bundle builds.
- All TypeScript strict errors must be fixed. No `any` except at genuine
  boundaries.

## State management conventions

- Single top-level Zustand store in `src/store/useAppStore.ts`.
- All state + actions inline; use `get()` for cross-action reads, `set()` for
  writes.
- **Immutable updates only** — return new objects/arrays, never mutate.
- Derived values live in `useMemo` inside components, not in the store.
- For persisted state that may evolve, ensure the loader has a migration step
  that adds sane defaults for newly-introduced optional fields so older saved
  files load cleanly.

## Type conventions

- Shared types in `src/types/index.ts`; domain-specific types next to their
  components.
- `interface` for public shapes, `type` for unions / utility types.
- Optional fields marked with `?:` and guarded at read sites.
- Export helper functions next to related types
  (`isThingInCollection(thing, collection)`).

## Styling

- Plain CSS files co-located with components. Global rules in `src/index.css`;
  CSS custom properties for scale/theme. No CSS-in-JS, no Tailwind unless
  explicitly asked.

## Comments

- Explain **why**, not what. Call out non-obvious consequences, known bugs
  you've fixed, and invariants future readers need to preserve.
- When fixing a subtle bug, leave a comment referencing the symptom ("without
  this, X ping-pongs between Y and Z") so the fix isn't reverted later.

## Testing & verification

- For UI / frontend changes, verify in a browser before reporting done. Type
  checks and lint verify correctness, not feature behaviour.
- Prefer small, verifiable increments. Ship often, bump version every time.
