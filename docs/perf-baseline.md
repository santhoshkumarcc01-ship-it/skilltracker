# Performance baseline

Baseline captured before the Aurora Arcade changes from the repository's current production build output on Windows 11, Chromium/Playwright 1.52 package, at 1440 × 900. This is a bundle inventory, not an HTTP transfer or route-level bundle budget.

| Measure | Baseline | Collection method |
| --- | ---: | --- |
| Built JS chunks | 36 files | `.next/static/chunks` |
| Total JS, uncompressed | 1,713,485 bytes | File sizes |
| Total JS, gzip estimate | 519,569 bytes | Node gzip level default, all chunks combined |
| Largest chunk gzip estimate | 114,111 bytes | Node gzip, individual file |
| Lighthouse performance / accessibility | Not collected | No local Playwright Chromium executable was installed at baseline |
| LCP, CLS, INP, TBT | Not collected | Requires a browser trace/Lighthouse run; no values are inferred |

The all-chunk gzip total must not be compared with the per-route JavaScript budget: Next.js loads only a subset per route. The next pass should collect route requests from a production server and use Lighthouse CI with a repeatable mobile throttling profile. Baseline is a development aid, not a release score.
