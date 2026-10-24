# Travel Canvas — The short setup guide

**Goal:** One private bookmark for your travel plans. No NAS setup, Node.js, Docker, GitHub Desktop or manually entered database ID.

**This release is a prepared one-click *template*, not a live one-click URL yet.** Cloudflare only accepts *public* GitHub/GitLab source repositories for its Deploy button. This archive is code-only and can be used to make that source repository. You will still do one Cloudflare Access security setup before your plans are available.

## Phase A — Publish the source once (on GitHub.com, not GitHub Desktop)

1. Download **Travel_Canvas_One_Click_Template.zip** and extract it in Windows. Open the resulting `Travel_Canvas_One_Click_Template` folder. **Do not reuse your old `travel-canvas-cloudflare` repository or copy any `.git` folder.**
2. In your web browser, go to **https://github.com/new**. Name the *new* repository **`travel-canvas-template-public`**. Choose **Public** (required for the Deploy button). **Do not** initialize it with a README, .gitignore, or license. Select **Create repository**.
3. On the new empty repository page, choose **uploading an existing file**, or **Add file → Upload files**. In Windows Explorer select **all contents inside** the extracted `Travel_Canvas_One_Click_Template` folder (root files AND the `src`, `public`, `tests`, `legacy`, `fixtures`, `scripts`, `migrations`, and `docs` folders). Drag that selection into GitHub's upload area. **Do not drag the enclosing folder** or `package.json` will end up one level too deep. Check that GitHub shows `package.json` and `wrangler.jsonc` at the repository root. Commit/upload the files.
4. Copy your new repository URL (`https://github.com/YOUR_USERNAME/travel-canvas-template-public`). Double-click **`DEPLOY_HELPER.html`** from the extracted folder, paste that URL, and select **Open Cloudflare deployment**. It only constructs the official Cloudflare link; it does not send information elsewhere.

> **Privacy:** The source template contains a bundled example itinerary and test fixtures, not your saved personal plans. Still, never add your personal exported JSON backups, `.env` or `.dev.vars` files, tokens, or passwords to this public repository. Do **not** make your existing private GitHub repository public just to enable the button; its earlier Git history hasn't been audited.

## Phase B — Let Cloudflare set up the Worker and D1

5. Follow Cloudflare's deployment screen. Sign into **Cloudflare** and **GitHub** when requested. Choose the Free plan options where available. Use a **new** Worker/repository name if Cloudflare reports an existing name conflict; don't overwrite your previous Worker or database. Cloudflare creates and binds the new D1 database. Accept the project's **Build** command `npm run build` and **Deploy** command `npm run deploy` when shown. Wait for **both** stages to complete successfully. If a test, type check, or build fails, **stop**—do not remove the safety checks.

> The first Worker URL can display `Access is not fully configured` or a 503 error. **This is intentional.** At this point it serves no private trip data.

## Phase C — One-time access protection (required, not optional)

6. Open **Cloudflare → Workers & Pages → your new Travel Canvas Worker → Access → Protect this Worker behind Access**. Choose **All traffic**, including the production `workers.dev` address, not only previews. If asked, first initialize **Zero Trust** and choose its free tier. Restrict the allow policy to **only your own specific email**; do not leave `Everyone`, `Bypass`, or an entire email domain allowed. If the quick policy only offers Cloudflare-account membership or entire domains, finish initial protection narrowly, then edit its **Allow → Include → Emails** policy in **Zero Trust → Access → Applications** to your exact email before continuing.
7. You must copy **two identifiers** from that Access setup:
   - `ACCESS_TEAM_DOMAIN`: the domain in **Zero Trust → Settings**, like `yourteam.cloudflareaccess.com` (no `https://`).
   - `ACCESS_AUD`: the **Application Audience (AUD) Tag** for the newly created Travel Canvas Access application, in **Zero Trust → Access → Applications → that application → Configure / Additional settings**.
   In **Workers & Pages → your Worker → Settings → Variables & Secrets**, add those two as **runtime Variables** plus `ACCESS_OWNER_EMAIL` set to the exact approved email address. Save/deploy the settings. These are identifiers (not passwords); do not paste your Cloudflare login PIN or any JWT/token into the settings.

   | Runtime variable | Value |
   |---|---|
   | `ACCESS_TEAM_DOMAIN` | `yourteam.cloudflareaccess.com` |
   | `ACCESS_AUD` | Audience tag copied from Travel Canvas Access application |
   | `ACCESS_OWNER_EMAIL` | Your exact email address |

## Phase D — The five-minute acceptance check

8. Open the `workers.dev` URL **in an incognito window**. It must demand Access sign-in; sign in with the allowed email. Then use [OWNER_CHECKLIST.md](OWNER_CHECKLIST.md) to confirm that a moved stay saves after refresh, a second browser sees it, mobile works, and a downloaded JSON backup is saved outside Cloudflare.

**If you get stuck:** Share only the exact screen or the *first non-secret error line*. We can address that one obstacle without turning this into a 30-step infrastructure project. No need to touch your NAS or GitHub Desktop.

Official references: [Deploy button](https://developers.cloudflare.com/workers/platform/deploy-buttons/) · [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) · [GitHub browser folder upload](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
