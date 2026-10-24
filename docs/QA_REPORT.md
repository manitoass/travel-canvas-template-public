# Travel Canvas Cloudflare RC2 — QA report

**Date:** October 24, 2026 | **Status:** UI defects reproduced and corrected in local harness; production Cloudflare deployment **not yet verified**.

The previous RC1 report recorded 91 Node test cases and explicitly did **not** exercise the Cloudflare React UI in any browser. RC2 closes that local UI audit gap: **98 Node tests**, **23 component-UI browser scenarios**, **6 browser scenarios using the current cloud startup code with a mock server**, and **2 Chromium mobile touch scenarios** passed. The browser harness used React16 compatibility because installing the production React19 dependencies was not possible; therefore these are *not* proof that the Cloudflare Vite build works. See [UX_AUDIT.md](UX_AUDIT.md) for reproduced problems, exact fixes, residual risks, and deployment acceptance instructions.

## Existing backend and engine coverage


| Suite | Pass | What it covers |
|---|---:|---|
| Frozen calendar engine and legacy migration | 66 / 66 | Date arithmetic, linked-group behavior, collision ripple, locks, snapshots, v0.9 migration and randomized comparison against original engine |
| Cloudflare Worker/D1 signed JWT and API | 25 / 25 | RSA JWT verification, audience/email checks, unauthorized assets/API blocked, D1 setup auto-initialization, revision CAS, idempotency, engine projection, import, backup/restore, Cron retention, CSRF origin defenses, exports, invalid input |
| Static project preflight | PASS | React19 pinned, Worker always first for assets, no React16 runtime, D1 binding, required auth/route integration, schema available |

**Existing Node test cases: 91/91; plus 7 new RC2 UI source checks = 98/98.** Static preflight is an additional configuration check, not counted as a test case. More detailed assertions occur within individual test cases; count is not a claim of 91 separate browser gestures.

### Commands executed

```sh
npm test  # all 98 Node tests and static preflight
```

`npm test` includes `tests/ux/*.test.mjs` alongside the existing backend/engine tests. Code was tested under Node.js 22.16 with experimental local `node:sqlite` purely as a D1 test double; **the deployed Worker uses native Cloudflare D1 and does not require experimental Node SQLite**.

### What the tests confirm

- Real RS256-signed Access tokens validated against a mocked JWKS; tampered, expired, wrong issuer, wrong app audience and wrong-email tokens rejected.
- Private UI assets as well as plan APIs require signed owner identity; absent Access config fails locked.
- A blank in-memory D1 database is initialized on the first authenticated API call without any manual migration SQL.
- Identical repeated operation IDs do not duplicate edits. A stale `baseRevision` receives 409 and cannot overwrite a newer plan.
- Authenticated import adds plans rather than silently replacing existing journeys; its preview hash prevents changed-file race.
- Daily backup snapshot retention stays at 14; manual and restore snapshots can be created and previewed. Restore requires explicit confirmation and a pre-restore snapshot.
- Cross-site mutation requests and missing app write header are rejected.
- Original 66 tests continue to run against unchanged planning-engine source.


## Must still pass

- Production npm dependencies, React19/Vite8 build and typecheck; Cloudflare build/test/deploy.
- Real Cloudflare Access and D1, including saved plans across two actual devices.
- Live street tile requests under CSP, owner export/recovery, mobile touch on physical Android/iOS.
- No UI interaction checked in an emulated browser substitutes for the verified hosted code. Follow [RELEASE_GATES.md](RELEASE_GATES.md).
