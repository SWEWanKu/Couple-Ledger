# Couple Ledger Agent Instructions

## Core working policy

- Work one focused change at a time.
- Keep changes reviewable and small.
- Do not mix UI, auth, database, deployment, and refactor work in the same task.
- Before committing, verify the changed-file scope matches the task.
- Prefer stopping and reporting over guessing.
- Do not create or modify `.env`, `.env.local`, or any secret files.
- Do not commit generated folders such as `node_modules/`, `.next/`, `dist/`, or `build/`.
- Do not run destructive Git commands such as `git reset --hard`, `git clean`, force push, or history rewrite unless explicitly instructed by the human.

## Product direction

This project is 小岛账本, a private two-person couple ledger web app for the user and partner only.

Tone:
- warm
- cute
- private
- Animal Crossing / island game UI
- not corporate SaaS
- not generic finance dashboard

Main Chinese product name:
- 小岛账本

## Product layout direction

The private app must not use a RuoYi/admin-dashboard style layout.

Avoid:
- enterprise admin shell
- rigid left sidebar + topbar + table panel feel
- generic SaaS finance dashboard
- corporate cards and grid-only layout

Prefer:
- couple scrapbook
- island notebook
- handwritten ledger feeling
- sticker tabs
- parchment pages
- washi tape / memo / stamp details
- soft asymmetric composition
- playful Animal-Island navigation
- pages that feel like a shared life journal, not a management system

## Strict animal-island-ui design contract

For all visible product UI, `animal-island-ui` is the primary and mandatory UI foundation.

Before any UI work, Codex must inspect:
- `node_modules/animal-island-ui/AI_USAGE.md`
- `node_modules/animal-island-ui/README.md`
- `node_modules/animal-island-ui/dist/types/index.d.ts`

Canonical references:
- GitHub AI reference: `https://github.com/guokaigdg/animal-island-ui/blob/main/AI_USAGE.md`
- Local installed AI reference: `node_modules/animal-island-ui/AI_USAGE.md`
- Design prompt, when needed: `https://github.com/guokaigdg/animal-island-ui/blob/main/DESIGN_PROMPT.md`

Component and import rules:
- Do not invent component props.
- Import components only from the package root:
  - `import { ... } from "animal-island-ui";`
- Do not deep import package internals.
- Keep `import "animal-island-ui/style";` imported exactly once in `src/app/layout.tsx`.
- Do not copy, fork, or reimplement `animal-island-ui` source or CSS.
- Do not replace the library styles with a custom design system.
- Tailwind may be used only for layout, spacing, responsive grids, and small glue styles.
- If a desired component or prop is unclear, use semantic HTML plus Tailwind classes rather than guessing fake props.

For visible surfaces, controls, and decorative UI, prefer official components such as:
- `Card`
- `Title`
- `Button`
- `Input`
- `Select`
- `Radio`
- `Checkbox`
- `Divider`
- `Icon`
- `Cursor`
- `Loading`
- `Tooltip`
- `Table`
- other documented exports when appropriate

UI must visually match the official `animal-island-ui` style:
- Animal Crossing / island game feeling
- warm parchment background `#f8f8f0`
- content cards `rgb(247, 243, 223)`
- brown text `#794f27` / `#725d42`
- muted brown `#9f927d`
- mint accent `#19c8b9`
- thick rounded corners
- ribbon titles
- playful badges/stamps
- game-like buttons
- green island background
- parchment card / notice-board surfaces
- cute wallet/memo/ledger metaphors
- no generic SaaS style

Avoid:
- cold blue/purple SaaS gradients
- glassmorphism as the main style
- plain Tailwind cards/buttons when an `animal-island-ui` component exists
- shadcn-style UI
- antd-style UI
- generic corporate finance dashboard look
- public signup language
- fake private data presented as real data

When refactoring existing pages, migrate visible UI surfaces toward `animal-island-ui` components rather than adding more one-off custom Tailwind UI.

For each future UI task, Codex final response must report:
- which `animal-island-ui` components were used
- whether `AI_USAGE.md` was inspected
- confirmation that no fake props were invented

## Next.js project rules

- This is a real Next.js App Router project, not a standalone `index.html`.
- Do not convert pages into a single self-contained HTML file.
- Keep `animal-island-ui/style` in `src/app/layout.tsx` only.
- Use `src/app/loading.tsx` for route loading UI when requested.
- Do not introduce forced splash delays unless the human explicitly asks for a forced splash screen.

## Security and data rules

- Supabase Auth and RLS will be the real security boundary later.
- Do not use a service role key in app code.
- Do not implement ledger persistence with `localStorage`.
- Do not add Supabase clients, migrations, or auth logic unless the task specifically asks for that step.
- Do not expose or commit secrets.
