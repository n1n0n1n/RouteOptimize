# RouteOptimize — Setup Guide

## What Changed (GitHub Pages Fix)

The original project included a **Node.js backend** (`server.js`) that handled login, forgot-password, and route savings. GitHub Pages only serves **static files** — it cannot run Node.js, which is why you saw the error.

**The fix:** All backend logic has been moved into `app.js` itself:

| Was (server.js)             | Now (app.js)                              |
|-----------------------------|-------------------------------------------|
| `POST /api/login`           | Checks credentials against a JS object   |
| `POST /api/forgot-password` | `alert()` with the same mock message     |
| `POST /api/route/optimize`  | `getMockSavings()` returns random values |

You no longer need `server.js` for GitHub Pages hosting. Keep it only if you later want a real backend.

---

## Google Maps API Setup (Step-by-Step)

### Step 1 — Create a Google Cloud Project

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it (e.g. `RouteOptimize`) and click **Create**

---

### Step 2 — Enable Required APIs

In your project, go to **APIs & Services → Library** and enable these three:

- **Maps JavaScript API** — renders the map
- **Directions API** — calculates routes between points
- **Places API** — allows text-based location search (autocomplete)

Search each by name and click **Enable**.

---

### Step 3 — Create an API Key

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → API Key**
3. Copy the key — it looks like: `AIzaSyAbc123...`

---

### Step 4 — Restrict the API Key (Important)

Without restrictions, anyone who finds your key can use your quota.

1. Click the key you just created → **Edit API Key**
2. Under **Application restrictions**, select **HTTP referrers (websites)**
3. Add your GitHub Pages URL:
   ```
   https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/*
   ```
   Also add `http://localhost:*` for local testing.
4. Under **API restrictions**, select **Restrict key** and tick:
   - Maps JavaScript API
   - Directions API
   - Places API
5. Click **Save**

---

### Step 5 — Add the Key to index.html

Open `index.html` and find the last `<script>` tag near the bottom:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY_HERE&libraries=places"></script>
```

Replace `YOUR_API_KEY_HERE` with your actual key:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyAbc123...&libraries=places"></script>
```

---

### Step 6 — Deploy to GitHub Pages

1. Push all files (`index.html`, `app.js`, `styles.css`) to your GitHub repository
2. Go to your repo → **Settings → Pages**
3. Under **Source**, select **Deploy from a branch**
4. Set branch to `main` (or `master`) and folder to `/ (root)`
5. Click **Save** — your site will be live at:
   ```
   https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
   ```

---

## Files You Need (GitHub Pages)

| File         | Required? | Notes                              |
|--------------|-----------|------------------------------------|
| `index.html` | ✅ Yes    | Entry point                        |
| `app.js`     | ✅ Yes    | Use the updated version            |
| `styles.css` | ✅ Yes    | Unchanged                          |
| `server.js`  | ❌ No     | Only needed for a real Node backend|

---

## Billing Note

Google Maps APIs require a billing account, but Google provides a **$200/month free credit** which is more than enough for a demo or small project. You won't be charged unless you far exceed the free tier.

Enable billing at: **Google Cloud Console → Billing**
