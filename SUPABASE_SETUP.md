# StudyPilot — Supabase Deployment & Integration Guide

For Gemini notes and quizzes based on uploaded slides, follow [AI_SETUP.md](AI_SETUP.md).

StudyPilot is fully wired for Supabase:
- **Authentication**: Email/Password Sign Up, Sign In, Password Reset, Auth Guard
- **PostgreSQL Database**: Real-time sync for Courses, Syllabi, Topics, Materials, and Student Profiles
- **Cloud Storage**: Secure uploads and downloads for study materials (PDF, PPTX, DOCX, images) via Supabase Storage bucket `studypilot-materials`
- **Offline / Local Fallback**: Instant local cache (LocalStorage + IndexedDB) with seamless cloud sync

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in or create a free account.
2. Click **"New project"**.
3. Choose your organization, set a project name (e.g. `StudyPilot`), generate a strong database password, and select your preferred region.
4. Click **"Create new project"** and wait ~1-2 minutes for the database to provision.

---

## Step 2: Run the Database Schema & Storage Migration

1. In your Supabase dashboard, click **"SQL Editor"** from the left sidebar.
2. Click **"New query"**.
3. Open the file [`supabase-schema.sql`](file:///c:/web/dev/StudyPiolot/supabase-schema.sql) in this repository.
4. Copy its entire content and paste it into the Supabase SQL Editor.
5. Click **"Run"** (or press `Ctrl`+`Enter`).

This automatically creates:
- `public.profiles` table with automatic user creation trigger
- `public.courses` table with Row Level Security (RLS)
- `public.syllabi` table with RLS
- `public.topics` table with RLS
- `public.materials` table with RLS
- `studypilot-materials` Storage Bucket with authenticated upload/download security policies

---

## Step 3: Copy Your Project API Credentials

1. In Supabase, go to **Project Settings** (gear icon at the bottom left) -> **API**.
2. Copy the following two values:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> `anon` / `public` key (the long JWT string)

---

## Step 4: Connect StudyPilot to Supabase

You can connect StudyPilot in **either of two ways**:

### Option A: In-App UI (No Code Changes)
1. Open [`login.html`](file:///c:/web/dev/StudyPiolot/login.html) in your browser.
2. Click the **"Connect Supabase"** badge at the top right of the login form (or in **Settings** -> **Supabase Cloud Sync**).
3. Paste your **Supabase URL** and **Anon Key**, then click **"Connect & Save"**.
4. That's it! Your browser will now talk directly to your live Supabase project.

### Option B: Hardcode in Config File
1. Open [`js/supabase-config.js`](file:///c:/web/dev/StudyPiolot/js/supabase-config.js).
2. Replace:
   ```javascript
   const DEFAULT_SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
   const DEFAULT_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
   with your actual URL and anon key.

---

## Step 5: Configure Supabase Auth Redirect URLs

To ensure confirmation emails and password reset links redirect properly:
1. In your Supabase dashboard, go to **Authentication** -> **URL Configuration**.
2. Under **Site URL**, enter your frontend URL (e.g., `http://localhost:5500` or your deployed URL `https://your-domain.vercel.app`).
3. Under **Redirect URLs**, add:
   - `http://localhost:5500/reset-password.html` (for local development)
   - `https://your-domain.vercel.app/reset-password.html` (for production)
4. Click **Save**.

---

## Step 6: Deploying the Frontend (Web Hosting)

Supabase provides the backend (PostgreSQL database, Auth, Storage, and Edge Functions). To host your frontend HTML/CSS/JS files for the world to see:

### 1. Deploying on Vercel (Recommended)
1. Push your code to a GitHub repository or install the Vercel CLI (`npm i -g vercel`).
2. Run `vercel` in the project root folder:
   ```bash
   vercel
   ```
3. Or go to [vercel.com](https://vercel.com) -> **"Add New Project"** -> Import your GitHub repository -> Click **Deploy**.

### 2. Deploying on Netlify
1. Go to [netlify.com](https://netlify.com) and log in.
2. Drag and drop the `StudyPilot` folder into Netlify's **"Deploy manually"** area, OR connect your GitHub repo.
3. Your site will be live instantly with a free SSL certificate.

### 3. Deploying on GitHub Pages
1. Push your repository to GitHub.
2. In your repo on GitHub, go to **Settings** -> **Pages**.
3. Under **Source**, select `Deploy from a branch` -> choose branch `main` and folder `/ (root)`.
4. Click **Save**. Your site will be published at `https://<username>.github.io/<repo-name>/`.
