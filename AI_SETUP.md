# StudyPilot: Gemini notes and quizzes

The active app is the HTML and `js/` files in this folder. Serve or deploy this
root folder to use the new integration. The transfer ZIP excludes the old nested
copy. See `README_FIRST.txt` and `Start-StudyPilot.cmd` to run it on another PC.

## How it works

1. Sign in with Supabase and upload PDF slides to a course's Study Materials.
2. Click **AI Notes** or **AI Quiz** beside a file, or open **AI Study Lab**.
3. Select a course and uploaded PDF. Optionally narrow the topic. Alternatively,
   paste lesson text without selecting a file.
4. The browser calls the `study_ai` Supabase Edge Function with the session JWT.
5. The function verifies the user, checks course/file ownership, downloads the
   private PDF with that user's permissions, and calls Gemini.
6. It validates the response and saves it in `ai_generations`. Identical requests
   reuse the cached output. Changing the source, topic, settings, model, or
   prompt version creates a new generation.

The UI displays notes and runs practice quizzes with scoring and explanations.
Generated notes and question sets are cached in Supabase. The existing
**Save Notes** library and saved quiz scorecards still use browser storage;
cross-device history and attempt analytics are a separate follow-up.

## One-time Supabase setup

Keep your existing Supabase URL, public key, Auth, tables, and storage bucket.
Do not rerun the original schema on an existing project: some original policies
are not idempotent.

1. Open your project's **SQL Editor**. Run the contents of
   `supabase/migrations/202610300001_ai_generations.sql` once.
2. Open **Edge Functions -> Secrets** and add:
   - `GEMINI_API_KEY`: your key from [Google AI Studio](https://aistudio.google.com/apikey).
   - `GEMINI_MODEL`: a PDF-capable model available to your account. The code's
     default is `gemini-3.8-flash`; you can override it here.
3. Deploy the function. With the Supabase CLI available, run from this folder:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy study_ai
   ```

   `supabase/config.toml` disables the legacy gateway JWT check for this
   function. **The handler still requires a Bearer token and verifies it through
   Supabase Auth before accessing data or calling Gemini.** This works with
   newer JWT signing keys too. Do not remove that verification.

   Dashboard alternative: create an Edge Function named `study_ai`, paste
   `handler.js` into its `index.ts`, turn off the gateway **Verify JWT** option,
   and deploy. The JavaScript handler also runs as TypeScript source.
4. Serve the root frontend with your usual local server or hosting setup.
5. Sign in and open **Settings -> Check AI Setup**. Version 2 checks the key and
   configured model with Google's model-metadata endpoint, without generating
   tokens or uploading a document. A green badge from an older deployment only
   confirms that a secret exists; redeploy the updated handler for this check.
6. Generate notes and a quiz from a small PDF to verify real Gemini access.
   Repeat the same request to confirm the cache message.

Never paste a Gemini key or Supabase service-role key into frontend JavaScript.
The function uses the platform-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY`
and the caller's JWT; it does not require a service-role key.

## Current limits and behavior

- PDF slides up to 10 MB; export PPT/PPTX to PDF before AI generation.
- Other file types can still be uploaded and downloaded as before.
- Pasted source text is limited to 20,000 characters.
- Quizzes support 3-15 questions; the existing UI offers 3, 5, or 10.
- Question count, four distinct options, answer index, and explanation are
  validated. Generated content can still contain factual errors; page references
  are model-produced and should be checked against the source.
- Gemini errors, quota errors, missing deployment, and unreadable/insufficient
  sources show errors. No template content is substituted.
- Notes are limited to 900 words, and Gemini 3 uses LOW thinking to reduce latency.
  Gemini generation times out after 90 seconds. Errors now identify whether the
  failure happened during model access, PDF download, database access, or generation.
- To update an existing Dashboard deployment: open `study_ai` -> Code, replace
  `index.ts` with the complete current `supabase/functions/study_ai/handler.js`,
  then deploy updates. Editing local files does not update the deployed function.
- Preview mode does not make AI calls. Sign in for generation.

## Local verification

```powershell
node --test tests/study-ai.test.cjs
```

The tests mock Supabase and Gemini. They do not create users, write to your
project, upload documents to Google, or spend API credits.

With Playwright installed, `node tests/ai-lab.browser.cjs` exercises the frontend
using intercepted requests. It defaults to installed Microsoft Edge; set
`STUDYPILOT_BROWSER=chrome` to use Chrome. It checks file links and selection,
notes rendering, quiz scoring, failure recovery, setup status, and mobile width.

References: [Gemini PDF inputs](https://ai.google.dev/gemini-api/docs/generate-content/document-processing),
[Gemini JSON output](https://ai.google.dev/gemini-api/docs/structured-output),
[Supabase function secrets](https://supabase.com/docs/guides/functions/secrets),
[Supabase Auth in functions](https://supabase.com/docs/guides/functions/auth-legacy-jwt).
