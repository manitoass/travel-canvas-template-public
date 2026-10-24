# One-click template — release gates

## Implemented, source-tested

- D1 binding has only `binding` and `database_name`; Cloudflare deploy workflow is expected to provision a new D1 and patch a real ID.
- `npm run build` compiles the pure TypeScript engine, runs source/cloud/UX tests, type-checks, and builds production assets; Cloudflare's Deploy command is separately `npm run deploy`.
- Worker-first static assets and signed Access token verification are unchanged from RC2: no configured owner/Access app => 401/503, **never a public planner**.
- D1 schema initializes on the first valid authenticated request; tested with a local D1-compatible SQLite adapter.

## Unverified until user deploys from public source

- A **public GitHub/GitLab source repository** must exist. We cannot generate a working Deploy link without its URL.
- Cloudflare's current provisioning UI actually builds React 19, writes D1 binding ID, and deploys Worker & assets successfully.
- Zero Trust Worker-level Access protects **all traffic** and allows only the owner's email.
- Correct runtime `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `ACCESS_OWNER_EMAIL` configured on that Worker.
- Fresh incognito and cellular phone access tested; plans persist across browsers after server acknowledgment.
- Manual snapshot and off-Cloudflare export tested; calendar/Ideas/mobile drag interactions verified on actual hosted React 19 build.
- Free-tier CPU/D1 usage observed with realistic journeys.

**Do not** weaken authentication or bypass test failures to make deployment green. No personal travel plans should be imported until these checks pass. See `OWNER_CHECKLIST.md`.
