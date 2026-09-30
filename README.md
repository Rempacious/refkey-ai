# RefKey // AI Referral Directory & Real-Time Management

A sleek, responsive, and real-time directory of AI API referral links, sign-up bonus credits, and router deals. Built with modern developer aesthetics (inspired by `freeapi-gist.vercel.app`, Vercel, and Linear).

---

## 🚀 Features

- **⚡ Real-Time Instant Management**: Add new links, edit details, update status (Active, Down, Dead, Unconfirmed, Fake), or delete anytime.
- **☁️ Zero-Cost Real-Time Backend via GitHub Gist**:
  - No databases to provision, configure, or pay for.
  - Never goes to sleep or pauses due to inactivity.
  - Updates commit to your GitHub Gist in milliseconds via GitHub REST API.
  - Visitors automatically receive fresh live updates without having to redeploy.
- **🎨 Sleek Modern Aesthetic**:
  - Dark mode by default with glowing active status dots & smooth theme toggle (Dark / Light).
  - Modern typography powered by *Inter* and *JetBrains Mono*.
  - Glassmorphic sticky header with instant search (`/` shortcut) and live category counters.
- **📋 1-Click Referral Link Copying**: Animated copy buttons with instant feedback for visitors.
- **🔒 Secure Admin Mode**:
  - Enter Admin Mode with `Alt + A` (or `Ctrl + Shift + A`) or by clicking the lock icon.
  - Your GitHub Personal Access Token is stored **strictly in your browser's local storage** on your device. Visitors never see your token.
- **💾 Backup & Restore**: Export your entire directory to JSON anytime, or import existing lists with one click.
- **🌐 100% Free Hosting Ready**: Deploy in seconds to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

---

## 🛠️ Quick Start (Local Setup)

1. Clone or open this folder in your code editor.
2. Start any local static web server. For example with Python:
   ```bash
   python -m http.server 8000
   ```
   Or with Node:
   ```bash
   npx serve .
   ```
3. Open `http://localhost:8000` in your web browser.

---

## ⚙️ Connecting Your GitHub Gist (Takes 1 Minute)

1. Open the website and press **`Alt + A`** or click the **Lock icon** in the top right to enter **Admin Mode**.
2. Click **Gist Settings** on the green admin bar.
3. Generate a GitHub Personal Access Token:
   - Go to [GitHub Token Settings](https://github.com/settings/tokens/new?scopes=gist&description=RefKey+Admin).
   - Check only the **`gist`** checkbox.
   - Click **Generate token** and copy it.
4. In the RefKey Admin Settings modal:
   - Paste your token into the **GitHub Personal Access Token** box.
   - Click the button **✨ Create New Gist for Me**.
   - RefKey will automatically create a new Gist under your account and link it!
5. To make this Gist the default for all public visitors, open `config.js` and set:
   ```javascript
   export const CONFIG = {
     DEFAULT_GIST_ID: "YOUR_GIST_ID_HERE",
     // ...
   };
   ```

---

## 🚢 Free Deployment Guides

### Option 1: Vercel (Recommended - 30 seconds)
1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Leave all build settings as default (Framework Preset: *Other*) and click **Deploy**.

### Option 2: Netlify
1. Drag and drop this folder directly into [app.netlify.com/drop](https://app.netlify.com/drop).
2. Your live site is instantly available!

### Option 3: Cloudflare Pages
1. Go to Cloudflare Dashboard -> **Workers & Pages** -> **Create application** -> **Pages**.
2. Connect your GitHub repository and click **Save and Deploy**.

### Option 4: GitHub Pages
1. Push to a repository named `<your-username>.github.io` (or any repository).
2. Go to repository **Settings** -> **Pages**.
3. Under **Branch**, select `main` and `/ (root)`, then click **Save**.

---

## ⌨️ Shortcuts & Hotkeys

| Shortcut | Action |
| :--- | :--- |
| **`/`** | Focus search input |
| **`Alt + A`** or **`Ctrl + Shift + A`** | Toggle Admin Mode |
| **`Escape`** | Close any open modal or clear search |
