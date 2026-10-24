# Travel Canvas — Guided Cloudflare deployment template

**Current status: ready-to-publish source template, NOT an already deployed application.**

This is the UI-reviewed Travel Canvas RC2 converted for [Cloudflare's Deploy to Cloudflare flow](https://developers.cloudflare.com/workers/platform/deploy-buttons/). The browser UI, calendar/planning logic, and conflict-safe D1 API are preserved. No Synology NAS, local Node.js installation, Docker, GitHub Desktop or database ID is needed **for the owner's deployment workflow**.

### Start here

1. **[READ_THIS_FIRST.md](READ_THIS_FIRST.md)** — short, nontechnical setup guide.
2. **[DEPLOY_HELPER.html](DEPLOY_HELPER.html)** — enter the URL of the public code template to open its Cloudflare deployment flow.
3. **[OWNER_CHECKLIST.md](OWNER_CHECKLIST.md)** — final sign-in, save, backup and phone checks.

#### Important limitation

Cloudflare's Deploy button requires a **public GitHub/GitLab source repository**. The code can be public; personal travel plans remain private in D1. **No public source URL exists yet for this copy of Travel Canvas**, so the Deploy button cannot be live until this code-only template is published to a new public repository. Do not convert an old private repository to public: its Git history may contain sensitive material. Create a new public *source-only* repository instead. You do not need to install GitHub Desktop or manage Git remotes.

After deploying the Worker, an owner must still configure **Cloudflare Access** for a single email and add three identifying Worker settings: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `ACCESS_OWNER_EMAIL`. This is an unavoidable security step in this release. The app is deliberately **locked by default** until those values are set; creating the D1 database does *not* grant public access to travel plans.

### What Cloudflare automates

- Copies code to a repository in your Git account (the source repository must be public).
- Builds the app using React + Vite (with tests before upload).
- Creates a fresh D1 database and fills in its ID/binding from `wrangler.jsonc`.
- Hosts the Worker and its assets at a `workers.dev` HTTPS address.
- Provides automatic builds for future repository updates.

The database schema initializes on the first **authenticated** request; no SQL editor or manual migration is needed. After signing in, edits are saved to D1 with revision checks. An import of v0.9 JSON adds journeys. Download full JSON backups periodically; in-D1 snapshots alone are **not** offsite backups.

### Security model

All **static assets and APIs** pass through the Worker (`run_worker_first: true`). The Worker verifies a signed Cloudflare Access JWT against the configured team domain, application audience and specific owner email. Requests without a valid identity or with missing settings are rejected. Don't replace this with a public no-auth preview. The Cloudflare Access dashboard rule must protect **All traffic** for the whole Worker.

A free plan can have quotas; Cloudflare availability and free tiers can change. This is not a promise of unlimited use or a tested production deployment.

### Technical notes (not needed for installation)

- Source: `src/web/` (React frontend), `src/engine/` (frozen planning rules), `src/cloud/` (Worker, Access JWT and D1 API).
- `wrangler.jsonc` has the D1 **binding/name only** on purpose, to trigger automatic provisioning. Do not paste an existing D1 ID.
- `npm run build` = compile pure engine -> 98 source/API/contract tests -> frontend TypeScript check -> production Vite/assets build. Cloudflare Git Builds detects this script.
- `npm run deploy` = `wrangler deploy`, which Cloudflare detects separately.
- TypeScript engine output `dist/engine/` is generated at build time; it is not hand-shipped.
- Frozen v0.9 reference under `legacy/` and golden parity corpus under `fixtures/` stay in the *source* repository but are not uploaded as static assets to the Worker.
- An actual React 19 production build and a live Cloudflare Worker/D1/Access end-to-end test were **not possible here** because this isolated environment cannot reach npm or the Cloudflare account. Do not consider the release accepted until the Cloudflare build and the short owner checklist pass.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/UX_AUDIT.md](docs/UX_AUDIT.md), and [docs/QA_REPORT.md](docs/QA_REPORT.md) for the original RC2 implementation details.
