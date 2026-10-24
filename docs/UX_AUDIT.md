# Travel Canvas UI/UX audit — Cloudflare RC2

**Reviewed:** October 24, 2026  
**Basis:** Actual Cloudflare RC1 source, v0.9 interaction baseline, browser-rendered React component test harness, locally simulated Cloudflare frontend, deterministic planning-engine and Worker tests.  
**Decision:** RC2 removes confirmed UI defects, but **it is not yet a Cloudflare-verified production release**.

## What was wrong and what changed

| Priority | Reproducible finding | What was corrected | Verification |
|---|---|---|---|
| P0 | A real drag held near the bottom of the calendar auto-scrolled but kept an old date delta; release could commit a date away from the visible pointer. | Recompute date-snapped preview after every auto-scroll increment using the current pointer coordinates. | Controlled browser reproduction before/after; regression drag test. |
| P0 | On a touch screen, swiping vertically while beginning near a stay could move that stay by multiple days instead of scrolling. | Touch stays now require 360 ms press-and-hold to move/resize; quick swipes manually scroll. Mouse behavior is unchanged. | Real CDP touch events: original altered Siem Reap February 15 to February 1; corrected swipe changes scroll position while preserving dates; separate press-hold moves the chosen stay by three days. |
| P1 | When multiple legs/stays overlap in a week, lane bars extended beyond the week row into the next row. | Dynamically size row height by allocated maximum lane. | Synthetic overlapping-legs fixture with row-boundary measurement. |
| P1 | Renaming a journey through Plans changed the data but left its header showing the old name. | Re-mount title input when actual active plan title changes. | Real browser Plan rename scenario in simulated cloud session. |
| P1 | Below 1320px, the saved/failed indicator was hidden; a phone could fail to save with no visible status. | Persistent compact save banner, including Retry and Download Unsaved actions for failures or conflicts. | Simulated server responses at 320, 390 and 800px; indicators and actions visible, no horizontal overflow. |
| P1 | Cloudflare Content Security Policy did not permit the app's own OpenStreetMap street-map image provider. | Limit permission specifically to `https://tile.openstreetmap.org` images. | Static CSP check and matching actual source URLs; **must still confirm tiles in live Cloudflare browser**. |
| P2 | One- and two-day fragments compressed text among link/lock/resize controls; tiny Sunday fragments often had no useful title. | Keep fragments visually clean, expose full selected stay name and Before/After link buttons in mobile strip. | Desktop/tablet/390/320 screenshots; Sunday and label/padding browser assertions. |
| P3 | Ribbon could be read as planned-night total when it meant elapsed journey span. | Say `journey span` for whole trip range. | Source and desktop screenshot. |

**P0/P1 describe the bug's possible effect before correction, not an assertion of real-world data loss.** These were identified and reproduced in controlled test fixtures.

## Behavior actually exercised in a browser

- **23 direct UI scenarios:** Legs/Journey/Leg Focus, navigate to muted leg, stay selection, lock/unlock, nights +/- and Undo/Redo, new leg, plan deletion/Undo, leg scenario fork/open, city lookup, unscheduled Ideas, Ideas-to-calendar buttons and drag, drag stay to Ideas, drag move and resize with live previews, drag-created range, map pin selection/fit, mobile calendar/map tab, mobile edit controls, Sunday link controls, text/control collision on three viewport sizes, narrow-screen overflow, keyboard undo, custom map pins.
- **6 simulated Cloudflare frontend scenarios:** fetch/load, save/revision update, server outage with visible retry and idempotent completion, stale version conflict with prompt and reload, plan rename, status/snapshots and restore preview.
- **2 actual mobile touch gesture scenarios:** swipe a touched stay to scroll without rewriting a date; hold 460ms and drag stay to intentionally change a date.
- **Visual snapshots:** 1440x900, 800x900, 390x844, 320x690. Confirmed no horizontal overflow at those widths. Stress fixture confirmed overlapping rows remain bounded.
- **Long-itinerary render:** 12 legs / 216 stays / 144 calendar rows / 277 displayed bar fragments, measured approximately 0.4-0.5 s to first-render in one headless Chromium session, and no JS exceptions; this is an environment observation **not** a mobile performance guarantee.

## Automated test accounting

| Test layer | Passed | Notes |
|---|---:|---|
| Existing calendar engine/legacy migration | 66 | Original source-level assertions and randomized parity |
| Cloudflare Worker and D1-compatible test double | 25 | Signed token, revision, restore, import and security |
| New UI source contracts | 7 | Structural guards for CSP, auto-scroll, lane size, rename, mobile links, touch, save banner |
| Browser UI interactions in compatibility harness | 23 | Current Cloudflare UI components, **React 16 test runtime** |
| Cloudflare frontend with mock API, browser | 6 | Current Cloudflare startup/client, simulated APIs—not a real Worker deployment |
| Emulated Chrome touch gestures | 2 | Actual mobile touch events and pointer interactions |

`npm test` includes **98 Node tests** (66+25+7) and the static preflight. The 31 browser/touch scenarios are separate manual harness runs; they are **not** included in Cloudflare's CI build because the runner is offline and uses a React16 compatibility shim. None of these checks establish a successful production React19/Vite bundling.

## Still unverified or not resolved in this audit

1. **Real React 19 and Vite 8 output:** package download was blocked, so the browser audit used current TS components transpiled against bundled React16 for test compatibility. A full `npm ci`, `npm run check:types`, `npm run build:verified` and bundled frontend browser test are mandatory before trusting a hosted release.
2. **Real Cloudflare Access/JWT redirects, Worker CPU limits, D1 transactions, cron and street tiles** need a live account with authenticated checks and realistic trips.
3. **Actual iOS Safari/Android Chrome and touch inertia:** touch input was emulated in Chromium, not performed on hardware. The chosen hold gesture intentionally trades immediate touch dragging for safer scrolling; validate that it feels natural.
4. **Assistive technology:** keyboard access to bars and buttons was partially checked, but a full screen-reader, contrast, tap-target/WCAG audit has not been performed. Twenty-pixel bar controls on desktop remain small.
5. **Design decisions to revisit, not silently change:** tapping an Idea currently schedules it; lack of easy touch drag-to-create without opening search; map in Journey scope shows per-leg pins rather than every stop; long plan titles truncate on small screens; Save indicator has no dedicated desktop dashboard history.
6. **Actual two-device synchronization and production rollback:** simulated contract tests passed but browser-to-real-D1 tests have not been run.

## Deployment smoke test, required before real use

After a clean React19 build and authenticated Cloudflare deployment, use a disposable sample plan to: (a) open desktop and a phone over cellular data; (b) move, resize, undo and redo a stay across week boundaries; (c) swipe over a calendar stay then press/hold-and-drag, verifying only the second action changes dates; (d) create/delete a leg, fork a scenario and add/remove an Idea; (e) check the Plans rename header and Journey/Leg Focus; (f) verify `Streets` loads tiles under actual CSP; (g) simulate failed save and stale tab conflict, verifying the phone visibly offers safe recovery; (h) refresh both devices and confirm dates, locks and links persist; (i) download JSON export and preview an actual D1 snapshot. No real personal plans should be imported until these checks pass.

## Preservation

RC1 remains unchanged. RC2 modifies presentation and pointer/feedback logic plus the Cloudflare CSP; it does not change the planning engine, stored plan format, database schema, API operation semantics or migration. Source control contains the QA fix commit.
