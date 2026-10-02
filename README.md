# Fitness Community & Activity Feed

A local-first fitness community feed and telemetry platform built with React 19, TypeScript, and Tailwind CSS v4. Features GPS route mapping, dynamic elevation charts, social kudos, threaded comments, weekly goal gauges, and community challenges without external backend dependencies.

- Live Demo: https://react-fitness-community-feed.vercel.app
- Source Code: https://github.com/mmy-lana/react-fitness-community-feed

---

## Key Features

- Activity Feed: Chronological stream supporting five sport types (Run, Ride, Swim, Hike, Workout) with sport-specific metrics and visibility badges (Public, Followers, Only You).
- Route Map Canvas: Pure SVG coordinate projection with longitudinal aspect ratio correction (`cos(midLat)`), start/finish pins, and expand-to-fullscreen modal view.
- Elevation Profile Charts: SVG quadratic Bezier path generation derived dynamically from GPS coordinates via the Haversine formula, paired with non-scaling strokes and HTML elevation callouts.
- Social Interaction: Single-action Kudos toggling and threaded commenting with author-only deletion safeguards and storage failure rollback.
- Manual Activity Logger: Form modal supporting metric units (meters for swimming, kilometers for land sports), route pattern generation (Loop, Out & Back, Climb, Stationary via Mulberry32 PRNG), and duration/elevation validation.
- Weekly Goal Tracker: Circular SVG ring gauge aggregating distance, active time, and elevation gain from Monday 00:00 local time against athlete targets.
- Club Challenges: Time-windowed community goals tracking cumulative distance and elevation milestones with dynamic progress bars.
- Mobile-First Responsive Shell: Tested on 360px, 390px, 430px, 768px, 1024px, and 1440px viewports. Features fixed bottom navigation, 44px minimum touch targets, and safe-area inset accommodation.

---

## Architecture & Engineering Highlights

- Single Shared Reactive Store (`src/services/storageStore.ts`): Built on React's `useSyncExternalStore` with cached snapshot references to prevent re-render loops. All mutations re-read storage atomically before writing to prevent race conditions.
- Runtime Schema Sanitization: Inbound storage payloads pass through shape validators (`sanitizeActivity`, `sanitizeUserProfile`, `sanitizeChallenge`) to drop corrupted fields and enforce non-null data contracts.
- Defensive Telemetry Math (`src/utils/telemetryMath.ts`): Bounded trigonometric terms in `haversineMeters` prevent `NaN` evaluation on antipodal coordinates. Calorie computations utilize standardized MET lookup tables with fallback defaults.
- Input Hardening (`src/utils/formatters.ts`): Title, description, and comment inputs strip unprintable Unicode control characters and Right-to-Left (BiDi) override exploits (`\u202A`–`\u202E`, `\u2066`–`\u206F`).
- Native Dialog Modals (`src/components/ui/Modal.tsx`): Built on HTML5 `<dialog>` with focus trapping, backdrop click selection protection, and scroll-lock reference counters.
- Global Error Boundary (`src/components/ui/ErrorBoundary.tsx`): Catches render-time exceptions with diagnostics, retry mechanisms, and emergency demo data reset capabilities.

---

## Tech Stack

- Framework: React 19
- Language: TypeScript (Strict mode, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`)
- Build Tool: Vite 8
- Styling: Tailwind CSS v4 (via `@tailwindcss/vite` and CSS `@theme` tokens)
- Package Manager: pnpm
- Testing & Verification: Puppeteer Core with headless Chrome

---

## Getting Started

### Prerequisites

- Node.js 20 or higher
- pnpm 9 or higher
- Google Chrome or Chromium (required for running the verification harness)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mmy-lana/react-fitness-community-feed.git
   cd react-fitness-community-feed
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

### Development

Start the local development server:
```bash
pnpm run dev
```

### Production Build

Type-check and compile the application bundle:
```bash
pnpm run build
```

Preview the production build locally:
```bash
pnpm run preview
```

### Linting

Run ESLint across TypeScript and TSX files:
```bash
pnpm run lint
```

---

## Automated Verification Harness

The project includes an end-to-end headless Chrome verification suite in `scripts/verify.mjs`:

```bash
pnpm run verify
```

To run an isolated test suite:
```bash
pnpm run verify -- --suite=modules       # Telemetry math, PRNG routes, formatters, storage
pnpm run verify -- --suite=ui            # Card rendering, SVG geometry, contrast, accessibility
pnpm run verify -- --suite=responsive    # 360px - 1440px viewport layouts and touch target floors
pnpm run verify -- --suite=interactions  # Kudos, comments, modal forms, filters, and reset flow
```

---

## Project Structure

```
.
├── public/
│   └── favicon.svg
├── scripts/
│   └── verify.mjs                     # Headless Chrome test runner
├── src/
│   ├── components/
│   │   ├── charts/                    # Route map and elevation SVG visualizers
│   │   ├── feed/                      # Activity feed, cards, stats grid, social bars
│   │   ├── forms/                     # Manual activity entry modal and validators
│   │   ├── icons/                     # Inline SVG action and sport iconography
│   │   ├── layout/                    # Header, AppShell, and mobile BottomNav
│   │   ├── sidebar/                   # Profile card, weekly goal progress, challenges
│   │   └── ui/                        # Button, Input, Select, Modal, ErrorBoundary
│   ├── hooks/                         # useActivities, useSocial, useWeeklyStats, useChallenges
│   ├── services/                      # storageStore (useSyncExternalStore client)
│   ├── types/                         # Pure TypeScript domain models
│   ├── utils/                         # Telemetry math, PRNG generator, formatters, sport maps
│   ├── App.tsx
│   ├── index.css                      # Tailwind v4 theme declarations
│   └── main.tsx
├── package.json
├── tsconfig.app.json
└── vite.config.ts
```

---

## License

MIT License. See LICENSE for details.
