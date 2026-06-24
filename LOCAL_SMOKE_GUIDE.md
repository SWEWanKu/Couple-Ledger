# Local Smoke Guide

This guide records the reliable Windows/Next.js smoke procedure for Couple
Ledger after the `feat: polish new record flow` work. It is documentation only:
it does not define product behavior, test fixtures, database state, or a new
test framework.

## Why This Exists

Local smoke checks on Windows previously timed out even when the application
looked like it should be running. The observed cause was stale Next.js child
processes that continued listening on ports after the parent process had been
stopped.

Important local behavior:

- `with_server.py` can leave unreliable Next.js child processes behind on
  Windows.
- A port such as `3000`, `3006`, or `3010` can look occupied because an old
  Next.js process is still alive.
- An already-listening port should not be trusted until the owning process is
  confirmed to belong to the smoke run currently being executed.
- A Playwright timeout by itself is not enough evidence of a product bug. First
  check HTTP responsiveness, server logs, and stale processes.

## Before Every Browser Smoke

Start by confirming the repository and port state.

```powershell
git status --short --branch
git rev-parse --short HEAD
git log -1 --oneline
```

Check the ports commonly used by local smoke:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 3000,3006,3010 } |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

If a port is already listening, inspect the owning process before using that
port:

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId=<PID>" |
  Select-Object ProcessId,CommandLine
```

Only stop a process when it is clearly a stale Next.js server for this project.
Do not blindly kill every Node process on the machine. A safe manual rule is:
the command line should point at `E:\Couple Ledger\node_modules\next` or an
equivalent Next.js process launched from this repo.

When possible, log the PID and port used for the current smoke run. If the
usual port is suspicious, use a confirmed free port instead.

## Production Route Smoke

Production smoke verifies that public and protected routes respond instead of
hanging. Run a fresh build before `next start`; `npm run start` can fail or use
stale output when `.next/BUILD_ID` is missing.

```powershell
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Before Playwright, use simple HTTP checks:

```powershell
curl.exe -I http://127.0.0.1:3000/
curl.exe -I http://127.0.0.1:3000/login
curl.exe -I http://127.0.0.1:3000/records
curl.exe -I http://127.0.0.1:3000/records/new
```

Expected result:

- `/` responds.
- `/login` responds.
- `/records` responds or redirects/protects.
- `/records/new` responds or redirects/protects.
- None of these routes should hang.

Production mode may intentionally disable Dev Login. Use dev mode for
authenticated smoke that depends on `/dev-login`.

After stopping the production server, confirm no project Next.js process is
still listening on the port used for the smoke.

## Dev Login And Authenticated Smoke

Use `npm run dev`, not production `npm run start`, when Dev Login is required.

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Verify:

- `/dev-login` reaches `/dashboard` for the primary user when primary dev env is
  configured.
- `/dev-login?persona=partner` reaches `/dashboard` when partner dev env is
  configured.
- Missing partner configuration should fail safely without printing secrets.

Secret handling rules:

- Do not print environment variable values.
- Do not print `SUPABASE_DB_URL`.
- Do not remove `SUPABASE_DB_URL` from ignored `.env.local` unless explicitly
  asked.
- Do not commit `.env.local`.
- Confirm `.env.local` remains ignored when relevant:

```powershell
git check-ignore -v .env.local
```

## Recommended Smoke Order

Use this order to separate build problems, route hangs, auth/session problems,
and browser automation problems.

1. Confirm `git status --short --branch` is clean or intentionally scoped.
2. Confirm the intended port is free, or log the current owning PID.
3. Run `npm run build`.
4. Start production server with `npm run start`.
5. Run HTTP smoke for route responsiveness.
6. Stop production server.
7. Confirm no residual project Next.js server is listening on the used port.
8. Start dev server on a confirmed clean port.
9. Run Dev Login browser smoke.
10. Run feature-specific route smoke.
11. Stop dev server.
12. Confirm no residual project Next.js server is listening on the used port.

## Current Core Smoke Routes

Use these routes for broad regression coverage. Some IDs are data-dependent and
should be discovered from the rendered page instead of hard-coded.

- `/`
- `/login`
- `/dashboard`
- `/records?month=2026-06`
- `/records?month=2026-06&type=expense&q=ctx-smoke`
- `/records/new?month=2026-06&type=expense&q=ctx-smoke`
- `/records/<recordId>`
- `/settlement?month=2026-06`
- `/settlement/history`
- `/settlement/history/<snapshotId>`

Feature-specific checks for the current records flow:

- `/records?month=2026-06&type=expense&q=ctx-smoke` keeps filter context.
- Links into `/records/new` preserve safe `month`, `type`, and `q` context.
- `/records/new?month=2026-06&type=expense&q=ctx-smoke` defaults the date inside
  the selected month.
- `/records/new` provides a safe return link back to the filtered list.
- `created=1` success state can be checked by URL without creating a real
  record.

## Known Expected States

The dev/private database has a known settlement regression month:

- `/settlement?month=2026-06` should show `fully_confirmed / 2/2` or equivalent
  user-facing copy.
- Unchanged `2026-06` should not show a false outdated snapshot warning.
- Unchanged `2026-06` should not show replacement proposal UI.
- `/settlement/history` should render.
- A snapshot detail route should render when a snapshot link is present.
- `/dashboard` should render the monthly summary and settlement teaser.
- Records list, new, and detail pages should show settlement awareness for
  `2026-06` when the data exists.

If this database state changes, report the new observed state instead of
rewriting smoke expectations from memory.

## Do Not Do This In Smoke

- Do not create fake records unless an approved cleanup path is available.
- Do not create fake settlement rows.
- Do not run cleanup deletes.
- Do not execute SQL.
- Do not use service role credentials.
- Do not use Supabase admin APIs.
- Do not bypass RLS.
- Do not print `SUPABASE_DB_URL`.
- Do not remove `SUPABASE_DB_URL` unless explicitly asked.
- Do not commit `.env.local`.
- Do not install dependencies.
- Do not add package scripts as part of a smoke-only check.
- Do not treat a Playwright timeout alone as a product bug before checking HTTP
  route responsiveness and stale processes.

## Failure Diagnosis Checklist

If all routes hang:

- Check stale Next.js or Node processes.
- Check occupied ports and owning PIDs.
- Check whether `npm run build` was skipped before `npm run start`.
- Check server logs from the current server process.
- Try a confirmed free port.

If only authenticated routes hang:

- Check Supabase connectivity.
- Check middleware/session handling.
- Check whether Dev Login is available in the current server mode.
- Confirm the relevant dev env keys exist without printing their values.

If only Playwright hangs while HTTP works:

- Check Playwright navigation timeout.
- Check the base URL and port.
- Check leftover browser or server processes.
- Check whether the test selected a broad link such as global `/records/new`
  instead of the route-specific action link.

## Static Safety For Smoke-Only Work

For documentation-only or smoke-only tasks, the expected static result is:

- no `src/**` changes;
- no `supabase/**` changes;
- no `package.json` or `package-lock.json` changes;
- no `.env.local` commit;
- no SQL execution;
- no RLS changes;
- no API route, server action, or helper changes;
- no runtime behavior changes.

Useful checks:

```powershell
npm run build
git diff --name-only
git diff --check
git diff --cached --check
git status --short -- .env.local package.json package-lock.json supabase src
```
