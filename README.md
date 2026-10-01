# Fitness Community & Activity Feed

A local-first community feed for logged activities: route maps, elevation
profiles, kudos, comments, weekly goals and challenges. No backend — the entire
dataset lives in `localStorage` behind one reactive store.

## Stack

- React 19 + TypeScript (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`)
- Vite 8
- Tailwind CSS v4 via `@tailwindcss/vite`, themed from CSS `@theme` tokens

## Commands

```bash
pnpm install
pnpm run dev       # dev server
pnpm run build     # tsc -b && vite build
pnpm run lint      # eslint
pnpm run verify    # headless Chrome verification (see below)
```

## Verification

`pnpm run verify` drives the real app in headless Chrome across four suites:

| Suite          | Server         | Covers                                                        |
| -------------- | -------------- | ------------------------------------------------------------- |
| `modules`      | `vite dev`     | telemetry math, route generator, formatters, storage engine    |
| `ui`           | `vite preview` | feed rendering, chart geometry, a11y wiring, theme and contrast |
| `responsive`   | `vite preview` | 360 / 390 / 430 / 768 / 1024 / 1440 layouts and touch targets |
| `interactions` | `vite preview` | kudos, comments, entry form rules, filters, nav, demo reset   |

Run one suite with `pnpm run verify -- --suite=interactions`. Screenshots land in
`.artifacts/` (gitignored). The harness uses the system Chrome; override with
`CHROME_PATH=/path/to/chrome`.

## Architecture notes

- **`src/services/storageStore.ts`** is the only writer of `localStorage`.
  Snapshots keep object identity while the raw JSON is unchanged, so
  `useSyncExternalStore` can compare them without re-rendering in a loop.
  Mutations re-read before writing, so two updates in the same tick cannot
  clobber each other, and failed writes surface through a `fitness_storage_error`
  event instead of throwing.
- **Sport styling lives in static records** (`src/utils/sportMaps.ts`). Tailwind
  v4 cannot see an interpolated class name, so a new sport becomes a compile
  error rather than an unstyled card.
- **Elevation profiles are derived** from an activity's own coordinates, so a
  route and its chart can never drift apart.
- **Nothing touches the network.** Avatars are initials, icons are inline SVG and
  GPS tracks are synthesized locally from a seeded PRNG.
