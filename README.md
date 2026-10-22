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
2. Open the Cloudflare link, enter your email, and click the sign-in link you receive.

Supabase's built-in email sender allows only a few sign-in emails per hour. That's enough for a small team. If someone gets a "too many emails" message, wait a few minutes.

---

## Optional: natural voice for interview questions
The app can read each interview question aloud. By default it uses Google's natural voice when that's set up, and the device's built-in voice otherwise. Kyle can switch voices or turn the voice off in Settings.
1. In Google Cloud Console, create a project and link a billing account. Chirp 3 HD voices include 1 million free characters a month, far more than interview questions use. Set a budget alert (Billing > Budgets & alerts) of $1.
2. Enable the **Cloud Text-to-Speech API** for the project.
3. **APIs & Services > Credentials > Create credentials > API key.** Restrict the key to the Cloud Text-to-Speech API. Don't add a website restriction, since Supabase calls it from a server.
4. In Supabase, add the secret `GOOGLE_TTS_API_KEY` with that key.
5. Deploy the `speak` function from [`supabase/functions/speak/index.ts`](supabase/functions/speak/index.ts) the same way as the other two.

## Privacy settings to turn on
- **Groq:** in the Groq console, open **Settings** > **Data Controls** and turn on **Zero Data Retention**, so recordings sent for transcription aren't kept.
- **Anthropic:** API data isn't used for model training by default. Keep the monthly spend limit you set.
- Only invited users can sign in, and recordings sit in a private storage bucket.
- Get ABG's sign-off before recording real student stories, since audio and text go to Groq and Anthropic.

## Using it
- **Student List:** list every student whose story is still only in Kyle's head (first name, roughly when, one line he remembers), one at a time or pasted as a list. Press **Record story** on any name to start their interview; it's marked recorded when the story is saved.
- **Student metrics card:** every student story gets the same measurable fields (starting grade, years with ABG, sessions, artworks, school attendance, graduation, what they do now, and more). Claude fills in what the interview says, and each value is marked Reported, Estimate or Verified. Only people can mark Verified.
- **Documented student outcomes** (Insights) adds the cards up across students, and each line says how many students it rests on.
- **Student outcomes for the consulting team** (Impact Reports) downloads one CSV row per student with first names replaced by codes.
- **Record a Story:** enter a first name, press **Record**, tell the story, press **Stop**. The recording is saved and transcribed into the text box, where it can be edited. Pause and Resume are available while recording. **Upload a recording** accepts voice memos up to 25 MB.
- Answer the follow-up questions the same way, skip any, or finish at any time.
- Review the Student Impact Report, then save it.
- To open straight to a new interview, bookmark the link with `#record` at the end. On iPhone, use Share > Add to Home Screen.

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
