# New Computer Setup – Next.js Development

This guide sets up everything needed to develop the atockorea Next.js site on a fresh Windows machine.

---

## 1. Node.js (required)

Node.js includes **npm** (package manager) and is required for Next.js.

### Option A: Install via winget (recommended)

Open **PowerShell** or **Terminal** and run:

```powershell
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

- Wait for the installer to finish (download + MSI install).
- **Close and reopen** your terminal (or restart Cursor) so `node` and `npm` are on PATH.

### Option B: Install from website

1. Go to [https://nodejs.org](https://nodejs.org).
2. Download the **LTS** version (Windows Installer `.msi`).
3. Run the installer; leave “Add to PATH” checked.
4. Restart your terminal or Cursor.

### Verify

In a **new** terminal:

```powershell
node --version   # e.g. v24.x.x or v22.x.x
npm --version   # e.g. 10.x.x
```

If these commands are not found, restart the terminal/Cursor or reboot once.

---

## 2. Git (optional but recommended)

You already have a git repo; if `git` is not installed:

```powershell
winget install Git.Git --accept-package-agreements --accept-source-agreements
```

Restart the terminal, then:

```powershell
git --version
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

---

## 3. Project setup (after Node.js is installed)

In the project folder (e.g. `c:\Users\sangsong\atockorea`):

```powershell
cd c:\Users\sangsong\atockorea
npm install
```

This installs all dependencies from `package.json`.

### Run the site

- **Development (with hot reload):**
  ```powershell
  npm run dev
  ```
  Then open [http://localhost:3000](http://localhost:3000).

- **Production build:**
  ```powershell
  npm run build
  npm run start
  ```

---

## 4. Environment variables (if needed)

If the app uses Supabase, Resend, Stripe, etc., copy env from another machine or create:

- `.env.local` (and optionally `.env`) in the project root.
- Add the variables your app expects (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

See other docs in `docs/` for service-specific setup (Supabase, Stripe, Resend, etc.).

---

## 5. Checklist

| Step                    | Command / action                          | Done |
|-------------------------|-------------------------------------------|------|
| Install Node.js LTS     | `winget install OpenJS.NodeJS.LTS` or .msi | ☐    |
| Restart terminal/Cursor | So `node` and `npm` are on PATH           | ☐    |
| Install dependencies    | `npm install` in project folder           | ☐    |
| Run dev server          | `npm run dev` → http://localhost:3000     | ☐    |
| (Optional) Git         | `winget install Git.Git` + config         | ☐    |
| (Optional) Env vars     | `.env.local` with API keys                | ☐    |

---

## 6. Useful npm scripts (this project)

| Command           | Description                |
|-------------------|----------------------------|
| `npm run dev`     | Start Next.js dev server   |
| `npm run build`   | Production build           |
| `npm run start`   | Start production server    |
| `npm run lint`    | Run ESLint                 |
| `npm run test`    | Run Jest tests             |
| `npm run test:watch` | Run tests in watch mode |

---

## If Node/npm still not found

1. Confirm Node.js is installed:  
   - Open “Add or remove programs” and look for “Node.js”.
2. Restart **Cursor** (or your IDE) so it picks up the new PATH.
3. Or reboot the computer once after installing Node.js.
4. If you used the .msi installer, run “Repair” from the Node.js installer to re-add to PATH.

Once `node` and `npm` work in a new terminal, run `npm install` and then `npm run dev` in the project folder.
