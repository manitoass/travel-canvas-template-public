# Travel Canvas — Go/no-go checks after deployment

Do **not** import sensitive or irreplaceable trip plans until the following work.

- [ ] **Cloudflare build** is green, with calendar/API tests, TypeScript, and production build passing (no bypass).
- [ ] **Private login**: a fresh incognito browser window is challenged by Cloudflare Access; an unapproved email cannot enter.
- [ ] **Saved data**: sign in, move a sample stay one day, wait for **Saved to server**, refresh; the date remains changed.
- [ ] **Second device**: another browser (and a phone on cellular data) loads that edited plan.
- [ ] **Safe conflict**: edit in one browser then try stale edit in another; the newer plan is not silently overwritten.
- [ ] **Touch**: swipe scrolls without moving dates; press-and-hold then drag intentionally moves a stay; links and Ideas are usable.
- [ ] **Map**: Atlas renders and optional Streets tiles load without CSP errors.
- [ ] **Recoverability**: open System, create a snapshot, and **download the full JSON backup**. Keep a copy on your laptop/NAS or another device, outside Cloudflare. An in-D1 snapshot is not an offsite backup.
- [ ] **Usage**: no unexplained errors in Workers Logs or persistent 1102 CPU / D1 quota failures.

**If any check fails:** do not overwrite the original v0.9/RC2 backup, and do not import real plans until resolved. A new Cloudflare deployment creates its **own new database**; it will not automatically contain the plans from another Worker or a browser-only prototype.

**Routine operation once the checks pass:** open your bookmark. Periodically download a backup (and before meaningful updates). No NAS maintenance or manual database IDs. Future source updates can be deployed by publishing changes to the repository Cloudflare created, but don't overwrite its D1 binding with the unconfigured template file during updates.
