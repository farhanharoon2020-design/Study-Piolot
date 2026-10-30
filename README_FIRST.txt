STUDYPILOT - COMPLETE PROJECT TRANSFER

RUN ON YOUR OTHER WINDOWS PC
1. Extract the ZIP. Run the app from the extracted folder, not inside the ZIP.
2. If Node.js or Python 3 is already installed, no packages need installing.
   Otherwise install Node.js LTS from https://nodejs.org and reopen the folder.
3. Double-click Start-StudyPilot.cmd and leave its window open.
4. Open http://127.0.0.1:5500/login.html in your browser.
5. Sign in with your existing StudyPilot account.
6. Open Settings -> Check AI Setup, then AI Study Lab to use a PDF.

Internet is required: Supabase and the Gemini integration run in the cloud.
Alternative: serve this folder with VS Code Live Server on port 5500.
Mac/Linux with Node.js: run node tools/serve.cjs from this folder.

YOUR EXISTING BACKEND
The app includes the existing Supabase project URL and public publishable key.
Use the same account to access courses and files already synced to Supabase.
Moving the frontend to a new PC does not require recreating the database,
rerunning SQL, redeploying the function, or creating another Gemini key.
The Supabase function must already be deployed as study_ai. Its environment
secrets GEMINI_API_KEY and GEMINI_MODEL stay in Supabase, outside this ZIP.
If Google reports model overload, the configured model may still need changing
or retrying later. Packaging does not resolve a provider outage.

WHAT TRANSFERS
All current HTML/CSS/JavaScript source, Supabase function source/configuration,
SQL scripts, setup guides, tests, and local startup tools are included.
The old nested duplicate app, temporary screenshots/logs, browser sessions,
and browser-only data are not included.
Browser-only notes/scorecards and unsynced files do not move automatically.
Cloud-synced material is retrieved after signing in on the other PC.

NEW SUPABASE PROJECT ONLY
Read SUPABASE_SETUP.md and AI_SETUP.md. The supplied SQL scripts are for setup;
do not rerun them on your existing working project just to move to another PC.
For local email confirmation/password reset, the destination project must allow
http://127.0.0.1:5500 and its auth redirect pages in the Supabase Auth URL settings.

VERIFICATION
With Node.js installed: node --test tests/study-ai.test.cjs
These tests use mocks and do not spend Gemini credits.
FILES.sha256 lists all packaged source files and their SHA-256 checksums.
