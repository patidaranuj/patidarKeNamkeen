# 🥛 Patidar K Namkeen — Milk Distribution App
## Complete Setup Guide

---

## What You Get
- ✅ Login system (email + password)
- ✅ Dashboard with revenue stats
- ✅ Take orders for any retailer
- ✅ Auto-calculated totals
- ✅ Print individual bills as PDF
- ✅ Manage retailers (phone, area, address, GSTIN)
- ✅ Manage products & pricing
- ✅ Multi-user with Admin / Helper roles
- ✅ Works on mobile, tablet, laptop
- ✅ Data synced across all devices in real-time
- ✅ **100% FREE** (Supabase free tier + Vercel free tier)

---

## STEP 1 — Create Your Supabase Database (FREE)

1. Go to **https://supabase.com** and click **Start for free**
2. Sign up with GitHub or email
3. Click **New Project**
   - Name: `pkn-milk`
   - Database Password: choose a strong password (save it!)
   - Region: `South Asia (Mumbai)` — closest to you
4. Wait ~2 minutes for the project to set up
5. Go to **SQL Editor** (left sidebar icon that looks like `</>`)
6. Click **New query**
7. Open the file `supabase-schema.sql` from this project
8. Copy the ENTIRE contents and paste into the SQL editor
9. Click **Run** (green button)
10. You should see "Success. No rows returned"

### Get Your API Keys
1. Go to **Settings → API** in your Supabase project
2. Copy these two values (you'll need them in Step 3):
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public key** — a long string starting with `eyJ...`

---

## STEP 2 — Create Your First Admin Account

1. In Supabase, go to **Authentication → Users**
2. Click **Add user → Create new user**
3. Enter your email and password
4. Click **Create user**
5. Now go to **Table Editor → profiles**
6. Find your user row and change `role` from `helper` to `admin`
7. Click **Save**

> ⚠️ Do this BEFORE deploying. This makes you the admin.

---

## STEP 3 — Set Up the Project Locally

### Install Node.js (if you don't have it)
Download from: https://nodejs.org (choose "LTS" version)

### Install the project
Open Terminal (or Command Prompt on Windows):

```bash
# Go into the project folder
cd pkn-milk

# Copy the environment file
cp .env.example .env.local

# Open .env.local and fill in your Supabase values:
# REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
# REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Install dependencies
npm install

# Start the app locally
npm start
```

The app opens at **http://localhost:3000**

---

## STEP 4 — Deploy to Vercel (FREE, takes 3 minutes)

### Option A: Deploy via GitHub (Recommended)
1. Push this project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/pkn-milk.git
   git push -u origin main
   ```
2. Go to **https://vercel.com** and sign up with GitHub
3. Click **Add New → Project**
4. Import your `pkn-milk` repository
5. In **Environment Variables**, add:
   - `REACT_APP_SUPABASE_URL` = your Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your anon key
6. Click **Deploy**
7. Done! You get a URL like `https://pkn-milk.vercel.app`

### Option B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel
# Follow the prompts
# When asked for env variables, enter your Supabase credentials
```

---

## STEP 5 — Add More Users (Helpers)

Once you're logged in as admin:
1. Go to **Users** in the sidebar
2. Click **+ Add User**
3. Enter name, email, password, and role
4. They can now log in from any device

---

## Daily Usage

### Taking an Order
1. Click **New Order**
2. Select the retailer
3. Enter quantities for each product
4. Click **Save Order** — total is auto-calculated

### Printing a Bill
1. Go to **All Orders**
2. Find the order
3. Click **🖨 Print Bill** — PDF downloads automatically

### Adding a New Retailer
1. Go to **Retailers**
2. Click **+ Add Retailer**
3. Fill in name, phone, area, address

---

## Free Tier Limits (you won't hit these for years)

| Service | Free Limit |
|---------|-----------|
| Supabase Database | 500 MB storage |
| Supabase Auth | 50,000 monthly active users |
| Supabase API | Unlimited requests |
| Vercel Hosting | 100 GB bandwidth/month |
| Vercel Builds | 100 builds/month |

For a milk distribution business with ~50 retailers and daily orders, you'll use maybe 5 MB/year. You're well within free limits.

---

## Troubleshooting

**"Missing Supabase environment variables"**
→ Make sure `.env.local` exists and has both variables filled in

**"Invalid API key"**
→ Double-check you copied the `anon public` key, not the `service_role` key

**Login not working**
→ Make sure you created the user in Supabase Auth → Users, not just in the profiles table

**PDF not downloading**
→ Allow pop-ups / downloads in your browser settings

---

## Project Structure

```
pkn-milk/
├── public/
│   └── index.html
├── src/
│   ├── context/
│   │   └── AuthContext.js      ← Login state management
│   ├── lib/
│   │   └── supabase.js         ← Database connection
│   ├── components/
│   │   └── Layout.js           ← Sidebar + navigation
│   ├── pages/
│   │   ├── Login.js            ← Login / signup screen
│   │   ├── Dashboard.js        ← Stats overview
│   │   ├── NewOrder.js         ← Take orders
│   │   ├── Orders.js           ← Order history + PDF bills
│   │   ├── Retailers.js        ← Retailer management
│   │   ├── Products.js         ← Product & pricing management
│   │   └── Users.js            ← User management (admin only)
│   ├── App.js                  ← Routes
│   ├── index.js                ← Entry point
│   └── index.css               ← All styles
├── supabase-schema.sql         ← Run this in Supabase SQL Editor
├── vercel.json                 ← Vercel deployment config
├── .env.example                ← Copy to .env.local
└── package.json
```

---

Built with ❤️ for Patidar K Namkeen
