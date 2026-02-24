# Repository Guidelines

## Project Structure & Module Organization
This repository is a Next.js App Router project.
- `app/`: route entry points (`layout.tsx`, `page.tsx`) and global CSS (`globals.css`).
- `components/`: reusable UI sections (for example `Navbar.tsx`, `Hero.tsx`, `Footer.tsx`).
- `constants/index.ts`: centralized content/config arrays used by components.
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
- Components: `PascalCase` file names and component names (for example `GetApp.tsx`).
- Variables/functions: `camelCase`; exported constants in `constants/index.ts` use `UPPER_SNAKE_CASE`.
- Imports: use the `@/` alias for internal paths (for example `@/components/Hero`).
- Styling: Tailwind utility classes in JSX; extend shared tokens in `tailwind.config.ts`.

## Testing Guidelines
There is currently no dedicated automated test suite in this repository. Use:
- `npm run lint` for static checks.
- `npm run build` for integration/type safety verification.
- Manual UI checks across desktop and mobile breakpoints for visual changes.

If you add tests, place them near features (for example `components/__tests__/Navbar.test.tsx`) and use `*.test.ts`/`*.test.tsx` naming.

## Commit & Pull Request Guidelines
Git history currently starts with a single `Initial commit`, so use clear, imperative commit messages going forward.
- Recommended format: `type(scope): summary` (example: `feat(navbar): add mobile menu toggle`).
- Keep commits focused and atomic.
- PRs should include: purpose, key changes, validation steps run, and screenshots for UI updates.
- Link related issues/tasks when applicable.
