# Aurora Arcade visual audit

This pass establishes a project-wide token and motion foundation. It does not claim to implement every section-specific animation from the creative brief.

## Pages

| Page | Shared visual changes | Page-specific animation added in this pass |
| --- | --- | --- |
| `/` | Aurora palette, surface, type and focus tokens | Ambient backdrop; existing landing motion uses the shared reduced-motion setup |
| `/login`, `/register`, `/signup` | Aurora form/card/button tokens | Shared input focus and button press feedback |
| `/dashboard` | Aurora tokens and game surface colors | Shared page and control motion only |
| `/story` | Aurora tokens and polaroid surface colors | Shared page and control motion only |
| `/materials` | Aurora tokens and folder/card surfaces | Shared page and control motion only |
| `/friends` | Aurora tokens and violet section accent | Shared page and control motion only |
| `/league` | Aurora tokens and league surfaces | Shared page and control motion only |
| `/report` | Aurora tokens and chart palette | Shared page and control motion only |
| `/motivation` | Aurora tokens and board palette | Shared page and control motion only |
| `/shop` | Aurora tokens; catalog swatches now reference CSS variables | Shared card and button motion only |
| `/onboarding` | Aurora tokens and form surfaces | Shared form and button motion only |
| `/settings` | Aurora tokens and control states | Shared toggle and button motion only |
| `/design-system` | Palette, gradient, themes and motion-tier preview | Tilt and spotlight samples; button interactions |
| Not found / error boundaries | Shared surfaces, text and focus tokens | Existing pet fallback motion respects reduced motion |

## Component inventory

All visual components below consume the Aurora token system, directly or through shared primitives. Shared UI provides the implemented interaction effects; page-specific animation coverage remains limited as shown above.

- Auth and landing: `auth/AuthForm.tsx`, `landing/LandingPage.tsx`.
- Dashboard and reports: `dashboard/Dashboard.tsx`, `reports/ReportDashboard.tsx`.
- Story, library and board: `story/MediaUploader.tsx`, `story/StoryCorner.tsx`, `materials/MaterialFileUpload.tsx`, `materials/MaterialLibrary.tsx`, `motivation/MotivationBoard.tsx`.
- Game and sound: `game/AchievementShelf.tsx`, `game/GamePreferences.tsx`, `game/PetShop.tsx`, `game/SoundControls.tsx`.
- Layout: `layout/AppShell.tsx`, `layout/HeaderStats.tsx`, `layout/LogoutButton.tsx`, `layout/NotificationCenter.tsx`, `layout/PageTransition.tsx`.
- Pets and settings: `pets/HopPet.tsx`, `pets/PetCompanion.tsx`, `pets/PetIllustrations.tsx`, `pets/PetSettings.tsx`, `settings/AccountSettings.tsx`.
- Shared UI and effects: `ui/index.tsx`, `fx/RevealOnScroll.tsx`, `fx/SpotlightCard.tsx`, `fx/TiltCard.tsx`.
- Providers: `providers/MotionProvider.tsx` applies reduced-motion and motion tiers; `providers/PerfHud.tsx` adds the development-only performance HUD. Auth and query providers were not otherwise redesigned.

## Effects added or standardized

- Theme variables cover light, dark and high-contrast modes. Hex literals were removed from app source outside the central CSS and TypeScript theme token files.
- Global ambient aurora and grain layers, shared skeleton shimmer, focus treatment, accent glows, button ripple/magnetic/press states, and theme reveal/fade transition.
- `MotionProvider` combines the OS preference with the saved app preference; low-tier and reduced-motion states disable nonessential effects. `useMotionTier()` exposes HIGH/MID/LOW and the FPS watchdog can downgrade to LOW.
- Reusable pointer-tilt, spotlight, and scroll-reveal primitives were added. Tilt is disabled for touch, reduced motion and LOW tier.
- Added a dev-only FPS/long-task HUD, toggled by Shift+P.

## Honest limits

- The dashboard, story, library, friends, report, pets, and motivation signature animations in the brief are not all implemented. Existing interactions largely receive shared theme and control treatment.
- Only the public design-system showcase has automated visual coverage. The app's authenticated routes were not captured because the available browser run had no local database/storage test stack.
- Lighthouse, Web Vitals, 4× CPU frame rate, per-route gzip budgets, INP, and CSS budgets are unmeasured and not enforced in CI. Lighthouse CI could not be downloaded because npm returned `ECONNRESET`.
- The full test command reports 43 passing tests and 24 PostgreSQL integration failures because local PostgreSQL is unavailable. Vitest is isolated from the Supabase URL, so these test attempts did not touch the hosted database.
- Next.js reports that React 18 support is deprecated and will be removed in Next.js 17; this pass did not change the app's React version.
