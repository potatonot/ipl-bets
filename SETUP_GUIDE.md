# IPL Bets 2026 — Complete Setup Guide

A private cricket betting site for your group. Clean, minimal, built with React + Supabase.

---

## What's included

- User auth (sign up / sign in)
- Place bets on IPL 2026 matches (one bet per match)
- Auto-settlement: when you mark a winner, all bets resolve instantly
- Public leaderboard with win rate bars, P&L, rankings
- Personal profile with full bet history & transaction log
- Admin panel: settle matches, adjust balances, add fixtures
- All 20 opening IPL 2026 fixtures pre-loaded

---

## Prerequisites

- Node.js 18+ installed ([nodejs.org](https://nodejs.org))
- A GitHub account
- A free Supabase account ([supabase.com](https://supabase.com))

---

## Step 1 — Set up Supabase

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
2. Create a new organisation and project
   - Give it any name (e.g. `ipl-bets`)
   - Set a strong database password (save it somewhere)
   - Choose a region close to you (e.g. `ap-south-1` for India)
   - Click **Create new project** and wait ~2 minutes

3. Once ready, go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Open the file `supabase_schema.sql` from this project
6. Copy the **entire contents** and paste into the editor
7. Click **Run** (green button)
   - You should see "Success. No rows returned" at the bottom
   - This creates all tables, policies, teams, and the first 20 IPL matches

8. Go to **Project Settings** → **API** (left sidebar)
9. Copy two values:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public** key (long string under "Project API keys")

10. Go to **Authentication** → **URL Configuration**
    - Add your GitHub Pages URL to **Redirect URLs**:
      `https://YOUR-GITHUB-USERNAME.github.io/ipl-bets/**`
    - Also add `http://localhost:3000/**` for local development

---

## Step 2 — Configure the project

1. In the project folder, copy the environment file:
   ```
   cp .env.example .env
   ```

2. Open `.env` and fill in your values:
   ```
   REACT_APP_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. Open `package.json` and update the `homepage` field:
   ```json
   "homepage": "https://YOUR-GITHUB-USERNAME.github.io/ipl-bets"
   ```
   Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username.

---

## Step 3 — Install and run locally

```bash
# In the project folder:
npm install

# Start dev server:
npm start
```

Your browser will open to `http://localhost:3000`. 

Create a test account and make sure everything works before deploying.

---

## Step 4 — Push to GitHub

1. Create a new repository on GitHub:
   - Go to [github.com/new](https://github.com/new)
   - Name it `ipl-bets`
   - Keep it **public** (required for GitHub Pages)
   - Do NOT add README or .gitignore (we already have those)
   - Click **Create repository**

2. In your project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit — IPL Bets 2026"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/ipl-bets.git
   git push -u origin main
   ```

---

## Step 5 — Deploy to GitHub Pages

1. Install the deploy tool (if not done via npm install):
   ```bash
   npm install gh-pages --save-dev
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

   This runs `npm run build` then pushes the `build` folder to a `gh-pages` branch.

3. On GitHub, go to your repository → **Settings** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: **gh-pages** / **(root)**
   - Click **Save**

4. Wait ~2 minutes. Your site is live at:
   `https://YOUR-USERNAME.github.io/ipl-bets`

---

## Step 6 — Share with your group

Send the link to everyone. Each person:
1. Goes to the site
2. Clicks **Register**
3. Fills in display name, username, email, password
4. Confirms email (Supabase sends a confirmation link)
5. Signs in and gets their starting ₹1,000 balance

---

## How to use the Admin Panel

Go to `/admin` in the site (every logged-in user can access it — restrict this if needed).

### Settling a match after it ends:
1. Go to **Admin → Settle Matches**
2. Find the match
3. Enter both scores (e.g. `187/4 (20)` and `183/6 (20)`)
4. Select the winner from the dropdown
5. Click **Settle**

The system will:
- Mark the match as completed
- Credit all winning bettors with 2× their bet amount
- Mark losing bets as lost (money already deducted when bet was placed)
- Update the leaderboard automatically

### Marking a match as Live:
Click **Mark Live** before the match starts to close betting.

### Adjusting balances:
Use **Manage Balances** to add or deduct from any user's balance manually (e.g. to add real money, fix errors).

---

## Adding more matches

The full IPL 2026 schedule has 84 matches. The first 20 are pre-loaded. As the BCCI releases more fixtures:

**Option A — Admin Panel:**
Go to **Admin → Add Match** and fill in the form.

**Option B — Supabase SQL Editor:**
```sql
INSERT INTO matches (match_number, team1_id, team2_id, venue, match_date, match_type)
VALUES (21, 5, 3, 'Arun Jaitley Stadium, Delhi', '2026-04-14 19:30:00+05:30', 'league');
```

Team IDs:
- 1 = CSK, 2 = MI, 3 = RCB, 4 = KKR
- 5 = DC, 6 = PBKS, 7 = RR, 8 = SRH
- 9 = GT, 10 = LSG

---

## Re-deploying after changes

Whenever you update the code:
```bash
git add .
git commit -m "Update: description of changes"
git push
npm run deploy
```

---

## Security notes

- The admin panel is currently accessible to all logged-in users. For a true private group this is fine since you control who signs up.
- To restrict admin to specific emails, add a check in `AdminPage.js`:
  ```js
  const ADMIN_EMAILS = ['youremail@example.com'];
  if (!ADMIN_EMAILS.includes(user.email)) return <div>Access denied</div>;
  ```

- Supabase Row Level Security (RLS) is enabled — users can only edit their own data.
- Bet settlement logic deducts balance on bet placement, so users can't bet more than they have.

---

## Project structure

```
ipl-bets/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   └── Navbar.js          # Navigation bar
│   ├── hooks/
│   │   └── useAuth.js         # Auth context
│   ├── lib/
│   │   └── supabase.js        # All DB operations
│   ├── pages/
│   │   ├── AuthPage.js        # Login / Register
│   │   ├── MatchesPage.js     # All IPL matches
│   │   ├── MatchDetailPage.js # Match + betting UI
│   │   ├── ProfilePage.js     # Personal stats
│   │   ├── LeaderboardPage.js # Public scoreboard
│   │   └── AdminPage.js       # Admin controls
│   ├── App.js                 # Routing
│   ├── index.js               # Entry point
│   └── index.css              # All styles
├── supabase_schema.sql        # Run this in Supabase first
├── .env.example               # Copy to .env and fill in
├── .gitignore
└── package.json
```

---

## Troubleshooting

**"Missing Supabase environment variables"**
→ Make sure `.env` exists and has the correct values. Restart `npm start` after editing `.env`.

**Authentication redirect not working on GitHub Pages**
→ Check that you added `https://YOUR-USERNAME.github.io/ipl-bets/**` to Supabase redirect URLs.

**Routes show 404 on refresh (GitHub Pages)**
→ Add a `404.html` file (copy of `index.html`) to the `public/` folder. GitHub Pages doesn't support client-side routing by default for direct URL access.

**Bets not settling**
→ Check the Supabase SQL Editor for errors. The `settleMatch` function in `supabase.js` handles settlement client-side using the anon key, which may be restricted by RLS. For production, consider moving this to a Supabase Edge Function with the service role key.

---

That's it. Enjoy IPL 2026! 🏏
