# Deploying BASE ARCADE

The app is one static HTML file with no build step, so this is about as simple
as deployment gets. Everything lives in `deploy/`:

```
deploy/
  index.html     the whole app (140KB)
  vercel.json    tells Vercel not to cache the HTML, so updates go live at once
```

Verified before packaging: 39/39 logic checks pass on `deploy/index.html`, and
it runs clean over HTTP (no console errors, localStorage works, all artwork
loads).

---

## Deploy to Vercel

You don't need to install anything — `npx` fetches the CLI on demand.

**1. Log in** (opens a browser; pick GitHub/Google/email):

```bash
npx vercel login
```

**2. Deploy a preview** from the deploy folder:

```bash
cd "/Users/unatisingh/Desktop/claude/deploy" && npx vercel
```

First run asks a few questions — the answers you want:

| Prompt | Answer |
|---|---|
| Set up and deploy? | **Y** |
| Which scope? | your own account |
| Link to existing project? | **N** |
| Project name? | `base-arcade` (or anything) |
| In which directory is your code? | **`./`** |
| Want to modify the settings? | **N** |

It prints a preview URL ending in `.vercel.app`. Open it on your phone and
check it before going further.

**3. Ship it to the real URL:**

```bash
cd "/Users/unatisingh/Desktop/claude/deploy" && npx vercel --prod
```

That gives you `https://base-arcade.vercel.app` (or whatever name you chose).

---

## Pushing an update later

Re-copy the file and redeploy:

```bash
cp "/Users/unatisingh/Desktop/claude/base-arcade-v2-experimental.html" "/Users/unatisingh/Desktop/claude/deploy/index.html"
cd "/Users/unatisingh/Desktop/claude/deploy" && npx vercel --prod
```

---

## If you'd rather not use the terminal

**Vercel drag-and-drop:** go to vercel.com/new, and drag the `deploy` folder
onto the page. Same result, no CLI.

**Netlify Drop:** app.netlify.com/drop — drag the `deploy` folder on. Instant
URL, no account needed to try it.

**GitHub Pages:** push `deploy/` to a repo, then Settings → Pages → deploy from
branch. Free, but the URL is longer and updates take a minute to appear.

Any of these work identically — it's a static file, so there's no server, no
database, and nothing to configure.

---

## Two things to know once it's live

**Scores are per-device.** The leaderboard keeps your best run in
`localStorage`, so it's tied to the browser you played in. Opening the URL on
your phone shows a fresh board. The other four names are placeholders — see
`fetchBoard()` in the source.

**Sound needs one tap.** Browsers block audio until the user interacts with the
page, which is exactly why the toggle ships off. Turning it on in settings
counts as that interaction, so it works from then on.

## Custom domain (optional)

In the Vercel dashboard: Project → Settings → Domains → add your domain, then
point a CNAME at `cname.vercel-dns.com`. HTTPS is issued automatically.
