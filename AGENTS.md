# HabitHop project rules

- Keep the request flow layered: route handler -> Zod validator -> service -> repository. Routes contain no business logic.
- Every API response uses exactly `{ data }` or `{ error: { code, message } }` as its outer shape.
- Check ownership on every resource access. Never trust a client supplied ID without an ownership check.
- Do not use copyrighted assets, including Duolingo logos, characters, or artwork. Create original artwork or use licensed assets.
- Respect `prefers-reduced-motion` in every animation.
- Use semantic Aurora Arcade CSS/Tailwind tokens for all UI colors; keep color literals only in the theme token sources.
- Use the shared motion tokens and `useMotionTier()` before adding an effect. Animate transform and opacity only; pause ambient motion when hidden/off-screen and keep reduced-motion to opacity or no motion.
- Components rendered beneath `MotionProvider`'s `LazyMotion` must use `m.*` from `framer-motion`, never `motion.*`, to preserve lazy feature loading and avoid runtime errors.
- Lazy-load heavy visual modules (charts, rich-text editors, particle/canvas effects) and keep pointer effects rAF-throttled without React state updates.
- Before finishing any task, run `npm run lint && npm run typecheck && npm test`.
- Update `README.md` and `ARCHITECTURE.md` whenever the project structure changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
