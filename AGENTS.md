# Repository Guidelines

## Project Structure & Module Organization
This repository is a Next.js App Router project.
- `app/`: route entry points (`layout.tsx`, `page.tsx`) and global CSS (`globals.css`).
- `components/`: reusable UI sections, with planner UI living primarily in `components/planner/`.
- `public/`: static assets (SVG/PNG) served from `/`.
- Root config: `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`.

Keep new UI sections in `components/` and compose them from `app/page.tsx`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server at `http://localhost:3000`.
- `npm run lint`: run Next.js ESLint checks.
- `npm run build`: create a production build (also catches type/build issues).
- `npm run start`: run the production build locally after `npm run build`.

For routine validation before opening a PR: `npm run lint && npm run build`.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict` mode enabled in `tsconfig.json`).
- Indentation: 2 spaces; prefer consistent semicolon/quote usage within edited files.
- Components: `PascalCase` file names and component names (for example `PlannerApp.tsx`).
- Variables/functions: `camelCase`; prefer file-local constants unless a shared module is clearly needed.
- Imports: use the `@/` alias for internal paths (for example `@/components/planner/PlannerApp`).
- Styling: Tailwind utility classes in JSX; extend shared tokens in `tailwind.config.ts`.

## Testing Guidelines
There is currently no dedicated automated test suite in this repository. Use:
- `npm run lint` for static checks.
- `npm run build` for integration/type safety verification.
- Manual UI checks across desktop and mobile breakpoints for visual changes.

If you add tests, place them near features (for example `components/planner/__tests__/TripsPanel.test.tsx`) and use `*.test.ts`/`*.test.tsx` naming.

## Commit & Pull Request Guidelines
Git history currently starts with a single `Initial commit`, so use clear, imperative commit messages going forward.
- Recommended format: `type(scope): summary` (example: `feat(navbar): add mobile menu toggle`).
- Keep commits focused and atomic.
- PRs should include: purpose, key changes, validation steps run, and screenshots for UI updates.
- Link related issues/tasks when applicable.

## Documentation Expectations
- When a change affects setup, configuration, public APIs, CLI commands, environment variables, deployment steps, or user-visible behavior, update the relevant documentation in the same branch.
- Check whether these files need changes:
  - `README.md`
  - `docs/`
  - `examples/`
  - `.env.example`
  - architecture decision records or runbooks
- Do not rewrite `README.md` for purely internal refactors unless the explanation is now inaccurate.
- Keep documentation changes minimal and specific to the code change.
- When behavior changes, update examples and code snippets so they still run.
- Before finishing, summarize any documentation updates made and any intentionally skipped docs with reasons.
- Documentation review automation is enforced in GitHub pull requests, not via local commit or push hooks.

## Review Guidelines
- Flag missing `README` or docs updates as a high-priority issue when the PR changes setup, API surface, config, auth flows, or operational behavior.
- Flag stale examples, stale environment variable lists, and mismatches between code and docs.
- Treat broken onboarding or setup instructions as a P1 issue.
- Treat docs typos as low priority unless they change meaning.

## Cloud Platform Guidelines
- Always look to maintain free/hobby/no-cost license usage in any cloud platform utilised.
- If limits seem likely to be breached then pause and ask for guidance.
