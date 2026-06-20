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

This project is a private couple ledger web app for exactly two people.

Tone:
- warm
- cute
- private
- Animal Crossing / island game UI
- not corporate SaaS
- not generic finance dashboard

Main Chinese product name:
- 灏忓矝璐︽湰

## animal-island-ui is the UI foundation

For all UI work, treat `animal-island-ui` as the primary visual and component foundation.

Canonical reference:
- GitHub: `https://github.com/guokaigdg/animal-island-ui/blob/main/AI_USAGE.md`
- Local installed copy: `node_modules/animal-island-ui/AI_USAGE.md`

Before using or changing `animal-island-ui` components, always inspect:
- `node_modules/animal-island-ui/AI_USAGE.md`
- `node_modules/animal-island-ui/README.md`
- `node_modules/animal-island-ui/dist/types/index.d.ts`

Rules:
- Do not invent component props.
- Import components only from the package root:
  - `import { ... } from "animal-island-ui";`
- Do not deep import package internals.
- Keep `import "animal-island-ui/style";` imported exactly once in `src/app/layout.tsx`.
- Do not copy or fork `animal-island-ui` source files into this repo.
- Do not replace the library styles with a custom design system.
- If a desired component or prop is unclear, use semantic HTML plus Tailwind classes instead of guessing.

Currently allowed style direction:
- green island background
- parchment card / notice-board surfaces
- brown text
- mint/green accents
- thick rounded corners
- soft playful shadows
- ribbon-like title treatment
- stamp/badge details
- cute wallet/memo/ledger metaphors

Avoid:
- cold blue or purple SaaS gradients
- glassmorphism as the main style
- corporate dashboard styling
- public signup language
- fake private data presented as real data

## Next.js project rules

- This is a real Next.js App Router project, not a standalone `index.html`.
- Do not convert pages into a single self-contained HTML file.
- Keep `animal-island-ui/style` in `src/app/layout.tsx` only.
- Use `src/app/loading.tsx` for route loading UI when requested.
- Do not introduce forced splash delays unless the human explicitly asks for a forced splash screen.

## Security and data rules

- Supabase Auth and RLS will be the real security boundary later.
- Do not implement ledger persistence with `localStorage`.
- Do not add Supabase clients, migrations, or auth logic unless the task specifically asks for that step.
- Do not expose or commit secrets.
