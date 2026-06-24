# Deployment Readiness Guide

This guide is the deployment checklist for the private two-person 小岛账本
app. It is documentation only: it does not add deployment code, CI, scripts,
schema, RLS, migrations, or database data.

## Purpose

小岛账本 is a private household ledger for exactly the two intended household
members. This is not a public SaaS launch, not a public signup flow, and not a
multi-tenant finance dashboard.

Use this guide before deploying to Vercel or another hosting platform, and use
`PRIVATE_APP_RELEASE_CHECKLIST.md` plus the module regression docs for deeper
manual smoke coverage.

## Current Production-Readiness Status

The latest production-readiness security audit passed after ledger hard-delete
paths were removed and record creation was moved to a transaction-safe RPC.

Current status:

- Dev Login is disabled in production by code because it requires
  `process.env.NODE_ENV !== "production"` and `ENABLE_DEV_LOGIN === "true"`.
- App code does not use a Supabase service role key or Supabase admin API.
- `.env.local` is ignored by git and must stay local.
- There is no ledger hard-delete app path.
- Record creation uses `create_ledger_record_v1`.
- Record edit uses `update_ledger_record_v1`.
- Soft void updates metadata and preserves split rows.
- Settlement V1/V2 and record mutation smoke currently pass against the
  private/dev project state described in the regression docs.

## Required Production Env Vars

Set only the browser-safe Supabase variables that the current app actually
uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the public browser-safe Supabase key.
If the Supabase dashboard still labels this as an anon key during the key
transition, place that public anon key value in
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

No production site URL env var is currently defined in `.env.example` or read
by app code. The auth callback route uses the request origin. Configure allowed
site URLs and redirect URLs in Supabase Auth settings for the deployed domain
instead of inventing a new app env var.

Do not put real values in this file or in committed docs.

## Local And Dev-Only Env Vars

These variables exist for local browser smoke only:

- `ENABLE_DEV_LOGIN`
- `DEV_LOGIN_EMAIL`
- `DEV_LOGIN_PASSWORD`
- `DEV_LOGIN_PARTNER_EMAIL`
- `DEV_LOGIN_PARTNER_PASSWORD`

Production hosting must not enable Dev Login. In the current route,
`/dev-login` only signs in when all of the following are true:

- `NODE_ENV` is not `production`;
- `ENABLE_DEV_LOGIN` is exactly `true`;
- the selected persona has local credentials configured.

In production, `/dev-login` must redirect to `/login`.

## Forbidden Production Env Vars And Secrets

Do not configure these in Vercel or any production hosting environment:

- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- any Supabase service role key
- any Supabase access token
- database password or direct database connection string
- `NEXT_PUBLIC_SUPABASE_DB_URL`
- any variable that exposes private database credentials through a
  `NEXT_PUBLIC_` prefix

`SUPABASE_DB_URL` may remain in ignored local `.env.local` when a task
explicitly requires local admin verification with Dockerized `psql`. It must not
be placed in production hosting env because the browser/server app does not need
direct database credentials, and leaking it would bypass the intended
Supabase Auth + RLS boundary.

## Supabase Database State Checklist

Project ref: `xveqdtvfgnmungycmwjq`.

Before deploy, verify the target Supabase project has the committed migrations
applied. This project has been using manually applied migrations through
Dockerized `psql`; do not run broad schema pushes during release unless a
separate task explicitly asks for that.

Expected database state:

- Core tables exist and RLS is enabled:
  - `allowed_user_emails`
  - `profiles`
  - `households`
  - `household_members`
  - `categories`
  - `ledger_entries`
  - `ledger_entry_splits`
- Settlement tables exist:
  - `settlement_snapshots`
  - `settlement_confirmations`
- Record mutation metadata exists on `ledger_entries`:
  - `updated_at`
  - `updated_by`
  - `voided_at`
  - `voided_by`
  - `void_reason`
- RPCs exist:
  - `create_ledger_record_v1`
  - `update_ledger_record_v1`
  - `confirm_settlement_replacement_snapshot`
- `ledger_entries` has no DELETE policy.
- Settlement V2 lifecycle metadata exists on `settlement_snapshots`.
- The app does not require a service role key.
- Generated Supabase Database TypeScript types are not currently used.

## Vercel Or Hosting Deployment Checklist

Use the same env boundary on Vercel or any other host:

1. Set only safe production env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
2. Do not set local-only Dev Login credentials in production.
3. Do not set forbidden direct database or service-role secrets.
4. Run:

   ```powershell
   npm run build
   ```

5. Confirm the deployment runs with `NODE_ENV=production`.
6. Confirm `/dev-login` redirects to `/login` and does not allow sign-in.
7. Confirm anonymous private routes redirect to `/login`.
8. Confirm Supabase Auth redirect and cookie behavior works on the deployed
   domain.
9. Confirm logs do not print secrets, DB URLs, tokens, or passwords.
10. If deploying outside Vercel, keep the same env rules and verify the host
    preserves secure cookies and request origins correctly.

## Post-Deploy Smoke Checklist

Start with read-only checks:

- `/` renders.
- `/login` renders.
- Anonymous `/dashboard` redirects to `/login`.
- Anonymous `/records` redirects to `/login`.
- Anonymous `/settlement` redirects to `/login`.
- The real login path works for an allowed household member.
- `/dashboard` renders after login.
- `/records?month=2026-06` renders after login.
- A record detail page renders after login.
- `/reports/monthly?month=2026-06` renders after login.
- `/settlement?month=2026-06` renders after login.
- `/settlement/history` renders after login.
- A settlement history detail page renders when a snapshot link exists.

Optional write smoke:

- Create a far-future temporary record only if it is acceptable to leave an
  audited soft-voided row behind.
- Use a unique note marker and a far-future month such as `2099-10`.
- Open the created record detail.
- Soft-void that same test record.
- Verify it disappears from the normal list.
- Do not cleanup-delete temporary records.

## Rollback Checklist

If deployment fails before DB writes:

- Roll back the app deployment.
- Keep the database unchanged.
- Re-run `npm run build` locally before retrying.

If app deploy works but auth fails:

- Check `NEXT_PUBLIC_SUPABASE_URL`.
- Check `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Check Supabase Auth site URL and redirect URL settings.
- Check cookie behavior on the deployed domain.
- Do not add Dev Login or service-role fallbacks in production.

If a DB schema mismatch appears:

- Do not hotfix the app with a service role.
- Inspect migration state first.
- Apply a missing committed migration only after confirming the target project
  and the exact missing migration.
- Do not run broad or unrelated SQL during rollback.

If a user data mutation bug appears:

- Stop using the app.
- Do not run cleanup deletes.
- Inspect with read-only queries first.
- Preserve evidence: affected route, user, timestamp, record id, and observed
  behavior.

## Security Checklist

- No service role key in app code or hosting env.
- No Supabase admin API in app code.
- No RLS bypass.
- No `localStorage` or `sessionStorage` as a data source.
- No `.env.local` commit.
- No `SUPABASE_DB_URL` in production env.
- No hard delete user flow.
- No payment provider behavior.
- No real money transfer behavior.
- No public signup flow unless intentionally added later.
- No generated DB types unless the project explicitly adopts them later.

## Known Limitations

- No formal test script exists yet.
- No generated Supabase Database TypeScript types are used.
- Dev Login is local-only.
- Settlement V2 replacement UI full real flow waits for a genuine outdated
  month or an approved safe data path.
- Custom split edit is deferred.
- Restore / unvoid for voided records is deferred.
- Voided history or audit view is deferred.

## Future Deployment Improvements

- Add a formal smoke script.
- Add CI for `npm run build`.
- Adopt Supabase CLI/project config if desired.
- Generate Supabase Database TypeScript types if the project chooses to adopt
  them.
- Add a monitoring and logging plan.
- Add a backup/export plan.
