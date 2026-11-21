# Performance after Aurora Arcade foundation

## Changes

- Added Aurora design tokens for light, dark and high-contrast themes, shared skeleton shimmer, and a CSS-only ambient gradient.
- Added Framer Motion `LazyMotion`/`domAnimation`, OS and preference-based motion reduction, HIGH/MID/LOW tier selection, and an FPS watchdog that downgrades effects after sustained sub-45 FPS.
- Added a dev-only FPS/long-task HUD (Shift+P), ambient pause hooks, transform-based pointer tilt, CSS-variable spotlight feedback, and IntersectionObserver reveal primitives.
- Added visual regression coverage for the public design-system showcase at 360, 768 and 1440 pixels in all three themes, plus a reduced-motion browser check.

## Verification status

| Measure | Result |
| --- | --- |
| Lint | Passed |
| TypeScript | Passed |
| Production build | Passed; 60 routes generated |
| Unit tests | 43 passed across 18 files |
| PostgreSQL integration tests | 24 failed across 7 files because no PostgreSQL server was available at the isolated local `localhost:5432` URL; 43 other tests passed. No test data was sent to Supabase. |
| Design-system visual E2E | Passed at 360, 768 and 1440 pixels across light, dark and high-contrast themes; no horizontal overflow |
| Reduced-motion E2E | Passed after checking the actual `.aurora-backdrop` layer |
| Lighthouse performance / accessibility | Not collected. Attempting to bootstrap Lighthouse CI failed with npm `ECONNRESET`. |
| INP / LCP / CLS / TBT and 4× CPU 60 FPS | Not measured |
| Per-route JS gzip / CSS budgets | Not measured or enforced; existing baseline is an all-chunk inventory, not route-specific |
| Every authenticated route screenshot | Not captured; visual E2E currently covers the public design-system showcase only |

These measurements do not establish that the requested Lighthouse, Web Vitals, frame-rate or bundle budgets pass. The FPS HUD helps with local inspection but does not replace performance CI. Full integration and authenticated-route review need a local PostgreSQL/S3 test environment and a working Lighthouse package download.
