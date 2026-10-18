# Online saves (email sign-in) and the backup file

Online saves stay switched off, with all their UI hidden, unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are both set at build time. The live site is unchanged until then. The backup file and Move a save (Settings ⚙ → Save files) work either way.

## Run it locally (no account needed)

```bash
npm run cloud:mock                     # mock Supabase on http://127.0.0.1:54321 (auth + saves table + mailbox)
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=local-mock-anon-key npm run dev
```

1. Open the game, then go to Settings ⚙ → Save files → enter any email → Send login link.
2. Read the "email" at `http://127.0.0.1:54321/mock/mail?email=you@example.com`. Open its `link` or type its 6-digit `code`.
3. To try two devices, use a second browser profile and sign in with the same email.

The mock (`tools/mock-supabase.mjs`) speaks the same REST calls as Supabase (GoTrue `/auth/v1/*` and PostgREST `/rest/v1/saves` plus `rpc/save_slot`). It emulates row-level security, so the game code it tests is the code that runs against real Supabase.

### With the real Supabase CLI stack (needs Docker)
```bash
supabase start            # applies supabase/migrations, mail goes to Inbucket on :54324
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<anon key printed by supabase start> npm run dev
```

## How sync works
- The table is `public.saves`, with one row per (user, slot 1–3). Row-level security means a player can only read and write their own rows. Writes go through `save_slot()`, a compare-and-swap on `revision`.
- Every autosave is uploaded while you're signed in. The game pulls on sign-in and at startup.
- If only one side changed since the last sync, the game fast-forwards silently. If both changed, that slot gets the conflict prompt (Keep this device / Keep cloud / Keep both) and its Continue is blocked. A running slot is never swapped silently.
- While offline, uploads and deletes wait in a queue (`rc-cloud-queue`) and are sent when the connection comes back.
- Co-op guests never sync or write.

## Going live (Luke)
1. Create a free project at supabase.com (Region: Sydney).
2. In the SQL editor, run `supabase/migrations/20261018000000_cloud_saves.sql`.
3. Authentication → URL Configuration:
   - Site URL: `https://neoscriptsforplex.github.io/stallhaven/`
   - Redirect URLs: add the same URL.
4. Authentication → Email templates → Magic link: paste `supabase/templates/magic_link.html`. It includes `{{ .Token }}`, so players also get the 6-digit code.
5. Email sending: the built-in mailer only sends a few emails per hour and is meant for testing. For real players, set up custom SMTP (for example Resend's or Brevo's free tier) under Authentication → SMTP, then raise the rate limits under Authentication → Rate limits.
6. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API) to the site's build, for example as GitHub Actions secrets or variables for the Pages build. Never add the service_role key.
7. Note: free projects pause after about a week with no activity. Sign-ins and syncs fail while a project is paused (local saves keep working), and it has to be resumed from the dashboard. Upgrade or keep the project active to avoid this.
