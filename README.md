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
2. The invited person taps **Accept the invitation** in the email. That's the only setup: the journal opens and stays signed in on that device.

### How staying signed in works
- After someone accepts their invitation (or signs in once on a new device), that browser stays signed in through refreshes, restarts, and weeks away. Opening the journal link goes straight to the Overview.
- Supabase refreshes the session automatically. A copy of the long-term sign-in token is also kept in a secure, HttpOnly cookie on the journal's own domain (`functions/api/session.js`, a Cloudflare Pages Function). If the browser clears the site's saved data, which Safari does after about a week without a visit, the journal quietly restores the session from that cookie.
- The cookie function reads the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` Pages variables, so there is nothing extra to set.
- **Log out** asks for confirmation and signs out only that device. Other devices stay signed in.
- If a device has no valid sign-in (a new phone, the home-screen app on iPhone, after logging out, or after access was removed), the journal asks for an email address and emails a 6-digit sign-in code and a link. Typing the code (in the app or the browser), or tapping the link in the same email, signs that device in. No passwords.
- To remove someone's access, delete them under **Authentication** > **Users**. Their devices are signed out within the hour.

### Sign-in codes (email OTP) and links
Sign-in is passwordless and invitation-only, handled entirely by Supabase Auth. One email carries a **6-digit code** and a **sign-in link**; either signs into the same account. The code is checked by Supabase, not by the journal: it expires after 10 minutes, works once, and verification is rate limited. Sending uses `shouldCreateUser: false`, so an email address that an administrator never invited can't get in. In the installed home-screen app the code comes first, because a link would open the web browser (and sign in there) instead of the app. The sign-in screen offers **Verify & Sign In**, **Resend code** (once a minute), **Use Email Link Instead** and **Change email**.

**Supabase settings** (Authentication > Sign In / Providers > Email):
- **Email OTP length:** 6
- **Email OTP expiration:** 600 seconds (10 minutes; this also limits the link)

Rate limits (Authentication > Rate Limits) stay at Supabase's defaults or stricter: emails per hour (through the custom SMTP sender) and OTP verifications per 5 minutes per IP.

**Email templates** (Authentication > Emails > Templates). Each template that signs someone in shows both the code and the link:

**Magic Link** (sign in):
```html
<h2>Sign in to the ABG Impact Journal</h2>
<p>Your 6-digit sign-in code is:</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:8px">{{ .Token }}</p>
<p>Enter this code on the sign-in screen, in the app or the website.</p>
<p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a> on the device and browser you use for the journal.</p>
<p>The code and the link expire in 10 minutes and work once. If you didn't try to sign in, you can ignore this email.</p>
```

**Invite user** (first sign-in for someone an administrator invited):
```html
<h2>You're invited to the ABG Impact Journal</h2>
<p>Arts Bridging the Gap has invited you to the Impact Journal, where staff record student stories.</p>
<p><a href="{{ .ConfirmationURL }}">Accept the invitation</a></p>
<p>Using the installed app, or reading this on another device? Open the journal, enter this email address, and type this code:</p>
<p style="font-size:30px;font-weight:bold;letter-spacing:8px">{{ .Token }}</p>
<p>After that, the journal stays signed in on that device. If this code has expired, enter your email on the sign-in screen and we'll send a new one.</p>
```

**Confirm signup** (Supabase uses this for an invited person who signs in before accepting): same as Magic Link, with the heading "Confirm your email for the ABG Impact Journal".

Supabase's built-in email sender allows only a few emails per hour, so this project sends through Brevo (custom SMTP). If someone sees a "sent very recently" message, wait a minute.

---

## Two portals: internal journal and Share Your Story

One site, one database, two experiences:

| Address | Who | What |
|---|---|---|
| `/` | Everyone | Landing page with **Share Your Story** and **Staff Sign In**. Signed-in staff go straight to the journal (or, for an authorized consultant, back to Preview Mode if that was the last portal they switched to). |
| `/app` | Invited staff (Kyle, ABG staff, consultants) | The internal journal. Unchanged sign-in: existing users never register again. |
| `/share` | Students, alumni, staff, parents, volunteers, friends | The public **Community Portal**. No account. It never signs anyone in and can't reach the journal. |

**Design.** The community portal uses the staff dashboard's design tokens from `src/styles.css` (cream background, navy headings, ABG purple primary buttons, teal secondary accents, warm gray borders) and the same palette illustration (`src/ui/art.js`). It is always light: the device's dark mode never applies (`color-scheme: light`, no dark rules in `src/community.css`).

**Community Portal flow:** Welcome → how you're connected to ABG (and whether you're 18 or older) → your own experience or one you witnessed → a little about you (optional; staff are asked whether they were an ABG student first) → talk or type → a short AI interview → review your story (edit it, untick anything wrong, choose whether ABG may ever share it publicly) → submitted. Contributors get a **private link** (`/share#s=…`) to check the status, answer ABG's questions, correct their story or ask for its removal.

**Security model**
- Contributors never get a Supabase account. Everything they do goes through the `community` Edge Function, which checks a long random private token per submission. Only a SHA-256 hash of each token is stored, and tokens live in the URL fragment, which browsers never send to servers.
- The function builds every AI prompt itself, so it can't be used as a general AI proxy. Limits: 6 new stories per connection per hour (connections stored only as hashes), about 7 follow-up questions, 24 AI calls per story.
- The database (`supabase/community.sql`) lets signed-in active staff **read** submitted stories (never unfinished drafts); only **administrators** can review, change or delete them. Nobody can insert submissions except the function. Every status or review change is logged in `submission_events` by a database trigger.
- **Minors:** anyone under 18 can only take part through a personal invitation that an administrator created after recording a parent or guardian's permission. This is enforced on the server, not just hidden in the page. Stories by or about minors are never shared publicly with names.
- **Voice:** contributors must agree to recording first. Audio is transcribed by Groq and immediately discarded; only the text is kept.
- **Preview Mode (portal switching):** accounts listed in `public.portal_preview_users` (seeded with `jacob.pajimola@pepperdine.edu`) who are also active administrators see **Settings › Portal Access** and can switch to `/share` without signing out. The journal shows the section only when `public.can_preview_portal()` returns true, and the community function re-checks the person's real Supabase sign-in, the list and the admin role before it accepts a test story. Test submissions are marked `is_test` by the server only (a database trigger blocks changing it from the browser), appear under Community Submissions › Test submissions, become journal stories labeled Test if approved, and are excluded from every count, chart, Source Comparison and export. The browser can't read or change the preview list. To add someone, insert their email into `portal_preview_users` in the SQL Editor.
- **Retention:** unfinished drafts are deleted after 14 days, rejected submissions after 180 days, and test submissions after 30 days. A contributor's removal request withdraws an approved story from all reporting at once; an administrator then deletes it. Administrators can delete any submission at any time.

**Inside the journal**
- **Community Submissions** (review queue): pending review, needs clarification, approved for internal reporting, rejected / excluded, removal requested. Open a submission to read the transcript, check the outcomes Claude extracted (same model as Kyle's interviews), fix the story type, then approve, ask the contributor a question (they see it on their private link), or exclude it (for example as a duplicate). Pending submissions never count in Impact Insights; approval creates an ordinary journal story labeled with its source. Public sharing stays a separate decision.
- **Evidence classes:** self-reported (someone's own experience), staff-observed (an ABG staff member saw it), community-observed (a parent, teacher, volunteer or supporter witnessed it), independently verified (checked against a record) and unconfirmed. A community account is never staff-observed or verified on arrival.
- **Source Comparison:** lists possible matches between accounts (a shared first name, plus program or school), shows two accounts side by side by impact area, and lets Claude suggest whether they're consistent, complementary, conflicting or insufficient. Only an administrator links them, after confirming it's the same person. Linking gives both stories one participant record, so the person is counted once; unlinking restores the original records. Conflicting accounts stay visible.
- **Impact Insights** adds Community Perspectives and Source Comparison sections, and filters for source, contributor type, evidence type and verification.
- **Invite Contributors:** the community link, a QR code (also downloadable), a ready-made message, and personal invitation links (shown once, stored only as a hash, limited uses and expiry). Only administrators can record guardian permission on an invitation.

**Setup for the Community Portal** (once)
1. Supabase > SQL Editor: run `supabase/community.sql` (after `admin-roles.sql`). It is safe to run again; re-run it after updates (the Preview Mode update added `is_test`, `test_by`, `portal_preview_users` and `can_preview_portal()`).
2. Supabase > Edge Functions: create a function named `community` from `supabase/functions/community/index.ts` and turn **Verify JWT off** (the public calls it without signing in; it checks its own tokens). It uses the same `ANTHROPIC_API_KEY` and `GROQ_API_KEY` secrets as the `ai` and `transcribe` functions.
3. `index.ts` is generated: edit `handler.ts`, `entry.ts` or `src/core/shared.js`, then run `node scripts/build-community.mjs`.
4. Cloudflare Pages serves the app for `/app` and `/share` automatically (single-page app fallback). Don't add a `_redirects` rule to `/index.html`: Cloudflare turns it into a redirect to `/`.

## How a story becomes evidence

**Interview (five stages).** Kyle tells the story in his own words first. Then about four to six follow-up questions, one at a time, fill only what's missing: (1) background and ABG involvement, (2) the most meaningful changes, (3) supporting evidence, (4) ABG's contribution, (5) current progress and follow-up. For each outcome the interviewer tracks the starting point, what changed, when, how Kyle knows, and ABG's possible role, and it asks about the most important gap. It never asks for records or diagnoses and never assumes causes.

**Two outputs.** A student impact story (narrative), and a structured impact record: one entry per outcome with category, description, initial and current condition, supporting observation, evidence source and type, numbers and units, timeframe, ABG program or activity, ABG's possible contribution, and open questions. Unknown fields stay empty (exported as `null` in the structured records JSON).

**Evidence types.** Verified by documentation (only when staff checked a document), directly observed by staff, reported by the student or a third party, or unconfirmed or inferred. A confident account is never treated as verified on its own.

**Brief review.** Before saving, Kyle sees the story and the outcomes found. He can fix the text, remove unsupported outcomes, and answer "How do you know?" for each. Planned outcomes are kept separate and become follow-up reminders. Everything else is under "All details".

**Impact Insights.** Impact overview, outcome analysis by area, evidence quality, and the stories behind every number (select any figure). Students are deduplicated; each figure states its denominator; the reporting period is by date recorded; "How these numbers are counted" spells out the rules.

**Stakeholder report.** Reports and exports > Stakeholder report builds an executive summary, key findings, outcomes by area, selected stories, evidence types and limitations from the records. External use includes approved stories only, with the privacy rules applied.

**Two story types.** Capture a Story starts by asking which kind of story it is: a **Student Impact Story** (unchanged) or a **Staff Impact Story**, about how ABG has shaped someone's employment, professional development, career, personal growth and community involvement. "Former ABG student" is a background attribute of a staff story, not a third type. Stories saved before this existed have no `storyType` and are read as student stories, so nothing older changes and no database migration is needed.

**Staff Impact Stories.** A short intake (first name required; current or former, role, start year, employment type, and "Was this staff member previously an ABG student?" with the student years and programs shown only for Yes) feeds a dedicated interview: background, employment, professional development, personal and community impact, long-term outcomes. It never asks for intake details again, distinguishes paid work from volunteering, stipends and internships, avoids financial and sensitive questions, and for a former student weaves in the move from participant to staff. "Unknown" is never treated as a former student. The analysis writes an impact narrative, key outcomes, a **staff impact card** (19 fields, each with its certainty and the supporting quote; blank means not documented, never "no"), the student-to-staff journey (only supported stages), stakeholder relevance for donors, grants, schools, community reporting and consulting deliverables, and quotes. The same person can have several stories; they're kept on one staff record and counted once. Linking a staff story to the same person's Student Impact story is done by a person from the story page, with a confirmation; it's never automatic or based on a first name.

**Staff & Employment Impact.** A section of Impact Insights: staff documented (unique people), paid opportunities documented, employment duration (only stated durations), career advancement, professional development, retention and later employment, the Student → Staff → Mentor / Professional pathway, and staff success stories, each clickable to the stories behind it. Every figure describes the people documented in the journal, not all ABG employees or every job ABG has created. Exports include a one-row-per-person staff CSV, the story type in the stories CSV, and a `staff` block (nulls for unknowns) in the structured records JSON.

**Administrators and users.** Two roles: **Admin** (invite and manage users, change roles, application settings, demo data, plus everything else) and **Standard user** (record, review, edit and export stories, Impact Insights). Roles live in the server-side `user_roles` table, keyed by authenticated email, and only the `admin` Edge Function changes them after checking that the caller is an admin. Admins use **Settings > Manage Users** to invite people (secure email invitation), change roles, resend invitations, deactivate or reactivate, and remove access; every change is recorded and shown under Recent activity. Nobody can change their own role or remove themselves, and the last active admin can't be demoted, deactivated or removed. Setup: run `supabase/admin-roles.sql` once (creates the tables and access rules and makes the five initial admins), and deploy `supabase/functions/admin` with "Verify JWT" turned off (the function checks the sign-in itself).

## Demo stories (fictional)

The first time an editor opens the journal, it adds eight fictional demo stories: six students (Michelangelo, Leonardo, Vincent, Frida, Pablo and Georgia) and two staff members (Diego, a former student who became lead teaching artist, and Mary, a teaching artist who went on to full-time teaching), all named after famous artists, so the Overview, Story Library and Impact Insights have something to explore. They live in `src/demoData.js` and go through the same steps as a real interview: transcript, analysis, review and save.

- Every demo record is marked `demo: true` and labeled **Demo** in the app. The students, schools, programs and outcomes are invented.
- Demo stories are **left out of reports and exports** by default. Settings > Demo Stories (or the notice on Reports and exports) can include them, marked "[DEMO, fictional]".
- Settings > Demo Stories can hide them everywhere, remove them all in one step, or load them again. Removing them never touches real stories.
- Real interviews never match a demo student or suggest linking to a demo story.

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

## ABG Impact Hub and Impact Materials

The staff workspace is the **ABG Impact Hub**. The Impact Journal (capturing stories) is part of it, together with **Impact Materials**: donor reports, proposals, packets, one-pagers and presentations made from ABG's approved stories and data, in designs made in Canva.

**Capture impact once. Communicate it in many ways.** The design comes from Canva. The AI only fills the content areas the design marks as fillable, using approved content. Staff review everything before a document is made, and an administrator approves it before it goes out.

### Navigation
The sidebar is grouped: **Home**, **Impact Materials** (Materials Library, Create New Material, Manage Templates, Generated Documents), **Stories** (Capture a Story, Story Library, Interview Guide), **Impact Insights** (Impact Metrics, Program Analytics, Source Comparison), **Community** (Community Submissions, Invite Contributors, Submission Review) and **Settings** (User Management, Content Bank, Canva Integration, System Settings). Every earlier page is still there.

On phones, the bottom bar has Home, Materials, Capture, Stories and Insights, and **Menu** (top right) opens the full navigation, including Settings.

**Home** has two equal action cards (Impact Materials and Capture a Story) and these panels:
- **Impact at a Glance:** live counts by program year, using the same rules as Impact Insights.
- **Needs Your Attention:** only real items, such as community stories to review, stories awaiting approval, approved stories missing consent for external materials, materials awaiting review, and drafts.
- **Recent Activity:** the latest stories, submissions, materials and template changes.

### Setup (one time)
1. **Database:** in Supabase, open **SQL Editor** > **New query**, paste all of [`supabase/materials.sql`](supabase/materials.sql) and **Run**. It is safe to run again. It creates:
   - the Impact Materials tables
   - the access rules
   - two private storage buckets (`templates` and `materials`)
   - the starting audiences and material types (Donor Materials › Individual Donors › Donor Impact Summary, and the rest), which administrators can rename, add to or archive in the app
2. **Canva (optional; uploads of PDF and PowerPoint templates work without it):**
   1. At [canva.com/developers](https://www.canva.com/developers/integrations/connect-api), create an integration for Canva's REST API.
   2. Turn on these scopes: `design:content:read design:content:write design:meta:read asset:read asset:write`.
   3. Add this redirect URL: `https://<project>.supabase.co/functions/v1/canva/callback`.
   4. In Supabase, add these Edge Function secrets:
      - `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET`
      - `CANVA_TOKEN_KEY` (any long random text; it encrypts the stored Canva tokens)
      - `SITE_URL` (the journal's address)
   5. Deploy [`supabase/functions/canva/index.ts`](supabase/functions/canva/index.ts) as a function named `canva`, with **Verify JWT turned off**. Canva's redirect arrives without a sign-in, and the function checks the sign-in itself on every other request.
   6. An administrator then opens **Settings › Canva Integration** and presses **Connect Canva**.

   **Canva requirements:**
   - Autofill needs the connected Canva account to be on Canva Pro, Teams, Enterprise or Canva for Nonprofits, with two-step sign-in turned on.
   - Only elements connected to **data fields** in Canva can change. In Canva, use Apps › Bulk Create or Data autofill to connect text and images to fields.
   - Rebuild the bundle after editing: `node scripts/build-canva.mjs`.

### Two ways to add a template (Impact Materials › Manage Templates)
Both kinds of template appear in one library, organized as **Audience → Material Type → Template → Version**.

| | Connect Canva Design | Upload PDF or PowerPoint |
|---|---|---|
| What to give it | A Canva design link | A file exported from Canva |
| What can change | The design's Canva data fields (text and images) | PowerPoint: any text box or picture you click. PDF: its form fields, or areas you draw on the page |
| Result | A **new copy** of the design in Canva (editable there) plus a PDF | PowerPoint: an editable .pptx. PDF: a finished PDF (not editable in Canva) |
| The master | Never changed (Canva's "create from design") | Never changed (stored once, read only) |

**Preparing designs in Canva**
- **PowerPoint (recommended for uploads):** use Share › Download › PowerPoint. Text stays as editable text boxes. Click each box or picture to map it. Shapes named `abg: field` or containing `{{field}}` are suggested automatically. Everything not mapped stays exactly as designed: slide size, backgrounds, branding, images, fonts, colors and alignment.
- **PDF:** Canva PDFs are flat, so text already printed in them can't be replaced. Leave the areas for new content **blank** in Canva before exporting, then draw those areas in the app.
  - An area drawn over printed text is refused, with an explanation, so text never prints on top of other text.
  - Text uses standard fonts, or your brand font (upload a .ttf or .otf with **+ Brand font**).
  - PDFs with real form fields are filled field by field.
- **Canva:** connect the elements that should change to data fields before connecting the design.

**Template editor:** each field records:
- its ID, page or slide, and exact location
- field type and content source
- formatting (font, size, smallest size, color, alignment)
- maximum length and lines
- whether it is required, and what to do if there's no content

**Test Template** fills the design with clearly fake sample content and shows the result. Text that doesn't fit is reported, never squeezed into an unreadable size. A template can only be approved after a passing test.

**Updating a design.** **Update Template**, in Manage Templates or on any generated document:
1. Upload or connect the revised design. It becomes the next version.
2. Fields that still match are carried over.
3. Test it, then choose **Replace Default Template** or **Create Template Variation**.

Approved versions never change, and every document keeps the exact version it was made with. To use a newer design on an older document, use **Regenerate**: it makes a new material and leaves the original untouched. **Edit content** changes only that document's text. **Update Template** changes the reusable design for future documents.

### Making a material (Create New Material)
1. Audience
2. Material type
3. Template (the default is preselected; variations can be chosen)
4. Content: reporting period, programs, approved stories, statistics, approved images and extra instructions
5. Generate Draft Content
6. Review: edit any field, see each field's sources, regenerate a field
7. Generate Document
8. Final review: preview, download, duplicate, regenerate, send for review, and **Approve** (administrators only)

Nothing is ever emailed, posted or published automatically.

**Accuracy and consent (enforced in the app and, where it matters, in the database):**
- **Exact content:**
  - Statistics, quotations, Content Bank text, dates and the reporting period are placed **exactly** as recorded.
  - The AI writes only prose fields (headline, introduction, story highlight, program overview, call to action).
  - Any number the AI (or a person) writes that isn't in the selected sources, any quotation that isn't an approved quote, and any name that isn't allowed is flagged as an error. The document can't be generated until it's fixed. Missing data is a warning, never an invented figure.
- **Statistics:**
  - Each statistic keeps its source, period and verification level: self-reported, staff-observed or independently verified.
  - Unverified or unapproved figures carry a warning.
  - Counts from the journal are labeled as counts of documented stories, not program-wide totals.
- **Stories:** a story can appear in an external material only when all of these are true:
  - it is approved for external use
  - it is not a test or demo story
  - for a community story, the contributor's sharing choice allows it and an administrator has confirmed it
  - for a minor, publication permission is documented
  - its **permitted uses** (printed and PDF materials, presentations, online) include the material type's use

  Permitted uses are recorded by administrators in Content Bank › Approved Stories or from the builder. Internal reporting approval is not external publication permission.
- **Images:** an image of an identifiable person needs documented consent (from a guardian for a minor) and must be permitted for that use.
- **What reaches the AI:** only approved story text, with names removed where permission isn't documented, plus approved quotes, statistics and approved messaging. Never transcripts or private details.

### Content Bank (Settings › Content Bank)
- **Core messaging:** mission, organization description, program descriptions, audience-specific messaging, calls to action.
- **Verified statistics:** value, source, period, verification level and approval status.
- **Approved stories:** the external-use status and permitted uses of each journal story. Stories are not copied; they stay in the Story Library.
- **Approved media:** images, with whether people are identifiable, consent, and permitted uses.

Only administrators change the Content Bank.

### Who can do what (enforced by `supabase/materials.sql`)
- **Staff:** browse templates, create and edit their own drafts, generate and download documents, and send them for review.
- **Administrators:** manage categories, templates and versions, defaults, the Content Bank and the Canva connection, and approve or archive materials.
- **Preserved records:**
  - A template version can't be approved untested, and once approved it can't be changed.
  - An approved material can't be changed or deleted, only archived.
  - Master templates are never deleted.
- **Canva tokens:** encrypted, and readable only by the `canva` function.
- **Community contributors:** no access to any of it.

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
- `supabase/functions/`: the `ai`, `transcribe`, `speak`, `admin`, `community` and `canva` server functions
- `src/materials/`: Impact Materials
  - `views.js`: the library, builder, material page, Content Bank and Canva settings
  - `templates.js`: Manage Templates and the template editor
  - `content.js`: consent rules, the AI request and accuracy checks
  - `pptx.js` and `pdf.js`: the PowerPoint and PDF fill engines
  - `engine.js`: generation and previews in the browser
  - `model.js`: the template library tree
- `supabase/materials.sql`: Impact Materials tables, access rules, triggers and storage buckets
- `scripts/build-canva.mjs`: bundles the `canva` function into one file for the Supabase editor
