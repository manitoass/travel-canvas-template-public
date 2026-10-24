# Travel Canvas — Everyday ownership (Cloudflare)

## Normal days

Open the HTTPS bookmark, sign in through Cloudflare Access if asked, and plan. Look for **Saved to server** after a calendar edit. No NAS Docker, certificate renewal, local Node process, cron job installation, terminal command, or Tailscale maintenance is needed.

## When there is a problem

- **Saving... persists / Not saved:** Do not close the browser immediately. Download an emergency unsaved copy, then review Worker status and try Retry save. Never assume changes reached D1 until acknowledged.
- **Conflict with newer browser:** Download the unsaved copy first; reload to see newer state. Resolve manually rather than force-overwriting it.
- **Signed out:** Sign in again with the same email address using Cloudflare Access. The application does not maintain a second password or recovery code.
- **Access error 403/503:** In Cloudflare confirm Access policy is assigned to this Worker and the three runtime variables match its audience, team and exact email. Do not disable Access to bypass an error.
- **App release failed:** Cloudflare Builds keeps a build log; do not weaken the build verification to force it online. A previous deployment may remain available; assess whether a rollback is necessary.

## Backups: important distinction

- In **System**, **Save snapshot** and **Restore snapshot** are convenient safeguards but remain **inside D1**.
- Daily job stores up to 14 snapshots; manual snapshots up to 8. Cloudflare's D1 Free Time Travel currently allows up to seven days of point-in-time recovery.
- **At least monthly and before large migrations or updates**, download a full `travel-canvas-backup.json` from **System** and save it to a separate device: your Windows PC + NAS or external drive. This portable backup is what protects against losing the Cloudflare database/account.
- Export/import preserves Journey, Leg, Scenario, Stay, Ideas and link/date semantics. Re-import the backup through **Plans > Restore backup** to **add** plans. Restoring an in-D1 snapshot via **System** replaces the whole current workspace only after a typed confirmation and a pre-restore safety snapshot.

## When app updates arrive

- Do not upgrade versions casually. Use the release ZIP and its changelog to confirm database changes/migrations.
- Preserve your original `.git` directory and real D1 Database ID in `wrangler.jsonc`.
- After downloading JSON backup, copy updated source into the existing private local repository, review changed files in GitHub Desktop, **Commit** and **Push origin**.
- Cloudflare Git Builds does the rest automatically, including tests and frontend build. Wait for the Cloudflare build success before relying on the updated app.
- Major updates may require additional steps. Read the release notes first.

## Free-plan limitations

Cloudflare's current Worker free tier includes a 10ms CPU limit per request and 100,000 requests per day, and D1 free databases have size/write/read caps. For this family-scale planning tool, the quota is plausible but not yet measured after deployment. If a limit is hit, saves may fail; do not silently switch to a paid plan. Download a backup and investigate.

## Moving back to your NAS later

Use **System > Download full JSON backup**. It uses the original portable prototype format. The NAS release remains separate; a future importer can be adapted to the same data model. Confirm parity with a migration test before abandoning the Cloudflare copy.
