# ABG Impact Journal

A private, interview-style impact journal for Arts Bridging the Gap. Kyle enters a student's first name, records the student's story, answers a few AI follow-up questions, and gets a Student Impact Report with supporting evidence, a timeline, and stakeholder-ready versions.

**How it runs**

| Piece | Service | Cost |
|---|---|---|
| Website | Cloudflare Pages | Free |
| Sign-in, database, recordings | Supabase (free plan) | Free |
| Transcription | Groq Whisper (free tier) | Free |
| Interview questions and impact reports | Anthropic Claude API | Pay per use, about 10 to 15 cents per story |

Secret keys live only in Supabase Edge Function secrets. The browser only ever sees the Supabase URL and its public anon key, and the database only answers signed-in, invited users.

---

## Launch checklist (about 20 minutes)

You need the accounts from Part 1: GitHub, Anthropic Console (with credits and a spend limit), Groq, Supabase (project created), and Cloudflare.

### 1. Set up the database and recording storage
1. Open your Supabase project, then **SQL Editor** > **New query**.
2. Paste the entire contents of [`supabase/setup.sql`](supabase/setup.sql) and press **Run**. It should say "Success. No rows returned."

### 2. Lock sign-in to invited people only
1. **Authentication** > **Sign In / Providers** (called **Providers** on some dashboards).
2. Turn **off** "Allow new users to sign up". Leave **Email** enabled.

### 3. Add the two secret keys
1. **Edge Functions** > **Secrets** (or **Project Settings** > **Edge Functions**).
2. Add `ANTHROPIC_API_KEY` with your Anthropic key.
3. Add `GROQ_API_KEY` with your Groq key.

### 4. Create the two server functions
For each function: **Edge Functions** > **Deploy a new function** > **Via Editor**.
1. Name it exactly `ai`. Replace the sample code with all of [`supabase/functions/ai/index.ts`](supabase/functions/ai/index.ts). Deploy.
2. Name it exactly `transcribe`. Replace the sample code with all of [`supabase/functions/transcribe/index.ts`](supabase/functions/transcribe/index.ts). Deploy.
3. Each function checks that the caller is signed in. If calls fail with 401 errors, turn **off** "Verify JWT with legacy secret" for that function; the function's own check still protects it.

### 5. Put the website online
1. In Supabase, open **Project Settings** > **API** (or **API Keys**) and copy the **Project URL** and the **anon / publishable** key. Do not use the service_role or secret key here.
2. In Cloudflare: **Workers & Pages** > **Create** > **Pages** > **Connect to Git** > choose this repository.
3. Build settings: Framework preset **Vite**, Build command `npm run build`, Output directory `dist`.
4. Under **Environment variables**, add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
5. **Save and Deploy**. When it finishes you get a link like `https://abg-impact-journal.pages.dev`.

### 6. Connect sign-in links to the website
1. In Supabase: **Authentication** > **URL Configuration**.
2. Set **Site URL** to your Cloudflare link, and add the same link under **Redirect URLs**.

### 7. Invite people
1. **Authentication** > **Users** > **Invite user**. Invite yourself first, then Kyle.
2. The invited person opens the email and taps the link. Tip for phones: long-press the link, copy it, and open it in Safari or Chrome. Email apps often open links in their own built-in browser, which doesn't share sign-ins with your regular browser.
3. On that first visit the journal asks them to create a password. After that:
   - The same browser stays signed in; just open the journal link.
   - On any other browser, phone or computer, they sign in with email and password, which the phone or browser can save and fill in.
   - Forgot the password, or skipped it? **Email me a sign-in link** on the sign-in page still works, and a password can be set or changed any time in **Settings > Profile > Password**.

Supabase's built-in email sender allows only a few sign-in emails per hour. That's enough for a small team. If someone gets a "too many emails" message, wait a few minutes.

---

## Natural voice for interview questions
The app can read each interview question aloud. By default it uses a natural voice from Groq (Orpheus), with the same `GROQ_API_KEY` used for transcription, so no new account is needed. It costs about $22 per million characters, which works out to a dollar or two a semester. If the natural voice can't be reached, the app falls back to the device's built-in voice. Kyle can switch voices or turn the voice off in Settings.
1. Deploy the `speak` function from [`supabase/functions/speak/index.ts`](supabase/functions/speak/index.ts) the same way as the other two, with "Verify JWT" off.
2. If Groq asks you to accept terms for the Orpheus model, accept them once in the Groq console playground.
3. Optional: to use Google Cloud Text-to-Speech instead, set the secrets `TTS_PROVIDER=google` and `GOOGLE_TTS_API_KEY`.

## Privacy settings to turn on
- **Groq:** in the Groq console, open **Settings** > **Data Controls** and turn on **Zero Data Retention**, so recordings sent for transcription aren't kept.
- **Anthropic:** API data isn't used for model training by default. Keep the monthly spend limit you set.
- Only invited users can sign in, and recordings sit in a private storage bucket.
- Get ABG's sign-off before recording real student stories, since audio and text go to Groq and Anthropic.

## Using it
The app has four sections: **Home**, **Stories**, **Impact Dashboard** and **Settings**, plus a **New Story** button that's always visible.
- **New Story** takes three steps:
  1. **Student information:** first name, gender, school, and optional details such as grade.
  2. **AI-guided interview:** tell the story, then answer short follow-up questions focused on measurable outcomes. Record or type each answer, skip any question, or finish at any time.
  3. **Impact report:** review and edit the report, which has six parts (student story, measurable outcomes, qualitative observations, supporting evidence, missing data and follow-up, and stakeholder impact summary), then save it.
  To record a program or mural story instead, use the link on step 1.
- **Stories** has three tabs: **All stories** (search and filter), **Student list** (students Kyle still wants to record) and **Follow-ups**. Follow-up tasks also appear on each story.
- **Impact Dashboard** has two tabs. **Overview** shows documented outcomes and evidence quality. **Reports and exports** generates the impact report and the CSV and Markdown downloads, including the anonymized file for the consulting team.
- **Settings** holds the program and school lists and the interview voice.
- To open straight to a new story, bookmark the link with `#record` at the end. On iPhone, use Share > Add to Home Screen.

## End of the semester
Export everything from **Impact Reports** (CSV and Markdown files) and give the files to ABG. You can then pause or delete the Supabase project and the Cloudflare site, and revoke the API keys.

## Local development (optional)
```
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

## Project layout
- `src/journal.js`: the app (interview, review, library, story pages, dashboard, reports)
- `src/platform.js`: connects the app to Supabase, the Claude API function, and recording storage
- `src/main.js`: sign-in screen and startup
- `supabase/setup.sql`: database tables, security rules, recording bucket
- `supabase/functions/`: the `ai`, `transcribe` and `speak` server functions
