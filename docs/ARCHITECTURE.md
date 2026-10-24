# Architecture decision: Cloudflare first, NAS remains the escape hatch

**Decision date:** October 23, 2026 | **Status:** Cloudflare RC2 prepared with UI bug fixes; hosted release gates pending

## Why the decision changed

The NAS release candidate required a Docker build on Synology, storage mounts, two containers (app + isolated Tailscale), HTTPS/Funnel configuration, restart checks, backups and updates. This was a useful architecture but not the simplest owner experience. Cloudflare + GitHub shifts those operational chores off the owner, at the cost of depending on a managed free tier and replacing the Node/SQLite local server with a Worker and D1.

## Chosen components

- **React 19 + Vite:** Browser calendar, atlas, Ideas, plans and versioning; no change to the proven calendar engine or its gestures by design.
- **Cloudflare Worker:** same-origin API; JSON validation, committed operations, safe revisional concurrency, daily scheduled backup snapshots; also serves bundled site assets.
- **Cloudflare D1:** one current normalized JSON document (max 1 MB) + a compact idempotency ledger + restore snapshots, not an unbounded history of complete copies.
- **Cloudflare Access:** only the designated email is allowed. The Worker verifies signed RS256 JWT, exact issuer, audience, expiry, JWKS and email, even for static assets. `assets.run_worker_first = true` is mandatory because Static Assets do not forward `ctx.access` today.
- **Cloudflare Git builds:** private GitHub repo on `main` triggers install, 91 checks, frontend typecheck, production Vite build, Wrangler deployment. No owner-managed server updates or certificates.
- **Default URL:** Free `travel-canvas.<account>.workers.dev`, with HTTPS; no paid domain.
- **Owner recovery:** daily snapshots in D1 and manual JSON download outside Cloudflare; D1 Free Time Travel currently seven days.

## End-to-end data path

1. Browser requests `workers.dev` URL; Cloudflare Access checks its allow policy and asks for email sign-in when required.
2. Worker independently cryptographically verifies `Cf-Access-Jwt-Assertion`, ensuring only the configured Access application and one owner email may proceed.
3. Worker serves generated Vite HTML/JS/data, or `/api` responses. It auto-creates any missing V1 database tables on the first authenticated request without resetting existing D1 content.
4. Browser downloads the saved plan; React previews an edit immediately via the unchanged TypeScript planning engine.
5. Browser sends `{operationId,baseRevision,type,operation,state}`; Worker applies validated rules and atomically compare-and-swaps document revision in D1, while recording compact idempotency history.
6. UI says `Saved to server` only when D1 responds. A 409 prevents stale tabs from overwriting newer data. Browser retains emergency recovery for failed saves.

## Privacy and operational boundaries

- The *whole Worker* and its static assets are Access-protected; no unauthenticated trip reads or mutations.
- Access is the front-door identity provider. No second app passwords, tokens stored in Git, custom identity database, recovery codes or local setup endpoints.
- Owner authentication requires **three Cloudflare runtime variables**: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ACCESS_OWNER_EMAIL`. The Worker intentionally refuses all data/asset requests until they are valid.
- `D1` binding name must be exactly `DB`. A blank or incorrect database ID fails closed.
- One single owner now; read-only links and spouse editing are not included in the current cloud migration.
- Cloudflare/D1/Access use a third-party platform and a free tier. Quotas, billing policies, account outages and loss of account are operational risks. Portable JSON exports preserve an exit route to the NAS implementation.

## Decisions to avoid complexity

- No NAS/Tailscale/Docker/npm installed by the owner.
- No custom Cloudflare account auth flow in React; email-only sign-in managed by Access.
- No extra ORM or managed SQL server.
- No object storage for photos or travel media in V1.
- No realtime collaboration engine; simple revision conflicts are safer for one owner.
- No automated risky cross-account backup requiring API tokens; owner exports JSON periodically.
- No D1 SQL commands for setup; the baseline V1 schema bootstraps automatically.

## Known limitations and release gates

1. React 19 + Vite 8 production build and Browser UI smoke checks have not been run in this restricted build environment. Cloudflare Git build is the first networked build test.
2. D1 `batch` concurrency and Cloudflare Access propagation must be verified in a real Workers+D1 environment; tests use a SQLite-based D1 mock with authentic signed JWTs.
3. The Worker Free tier has 10ms CPU/request; large plans may require optimization, not automatic upgrade. Store the plan JSON below 1 MB to leave headroom under D1's 2MB text value cap.
4. Manual exported JSON is a disaster backup; in-D1 snapshots alone are not protection from full Cloudflare data/account loss.
5. Cloudflare account billing, availability, and policy terms may change; the owner must stay within free plan limits.

## Portability back to Synology

Export `travel-canvas-backup.json` from the Cloudflare app. The export intentionally uses the original `travel-canvas-prototype` v1 state shape so a future NAS importer can reconstruct current journeys, legs, versions and dates. Import parity must be retested before switching back; the NAS RC1 was not deployed or validated.
