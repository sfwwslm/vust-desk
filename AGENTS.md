# Repository Guidelines

## Project Structure & Module Organization

- `src/` holds the React UI; common building blocks live under `components/`, domain flows in `features/` and `pages/`, shared logic in `hooks/`, `utils/`, and copy in `locales/`.
- `src-tauri/` contains the Tauri side (Rust commands, plugins, and `Tauri.toml` configs); native bundles emit to `src-tauri/target/`.
- `public/` serves static assets; `dist/` is the Vite build output consumed by Tauri; `docs/` stores project documentation and release notes.
- Root config of note: `vite.config.ts`, `tsconfig*.json`, and `pnpm-workspace.yaml`.

## Build, Test, and Development Commands

- `pnpm td` - run the Tauri + React dev app with hot reload (uses `src-tauri/Tauri.dev.toml`).
- `pnpm dev` - start Vite for UI-only work; `pnpm preview` serves the built UI for quick QA.
- `pnpm build` - type-check and emit the web bundle to `dist/`.
- `pnpm tb` - produce installers/bundles in `src-tauri/target/release/bundle/`.
- `pnpm prune` - report unused exports to keep the codebase lean.

## Coding Style & Naming Conventions

- TypeScript + React 19; prefer functional components and hooks (`use*`) for shared behavior.
- Use 2-space indentation, double quotes, and semicolons; keep imports ordered: std libs -> external deps -> `@/` aliases -> relative paths.
- Components in `PascalCase` (`MainLayout`), utilities/hooks in `camelCase` (`useHotkeys`), and constants in `SCREAMING_SNAKE_CASE` when shared.
- Co-locate styled-components with their usage; avoid global CSS except in `styles/`.

## Testing Guidelines

- No formal test suite is present; until one exists, treat `pnpm build` as the minimum gate (type + bundle check).
- When adding tests, place `.test.ts[x]` files next to the code they cover, mock Tauri plugins, and favor deterministic snapshots for UI.
- Aim for coverage of critical flows: app bootstrap (`src/main.tsx`), navigation, and persistence-related services.

## Commit & Pull Request Guidelines

- Submission guidelines: Use the English prefix "Conventional Commit" (e.g., `feat:`, `fix:`, `chore:`), and use Chinese descriptions after the colon.
- PRs should state the problem, solution, affected platforms (Win/macOS/Linux), and risk areas; link issues when available.
- For UI changes, attach before/after screenshots or short clips; note any new config keys or migration steps.
- Keep `dist/`, `node_modules/`, and personal configs out of commits.

## Security & Configuration Tips

- User data lives under `~/.vust/` (`config.json`, `data/` for SQLite, `icons/` cache); avoid hardcoding secrets or paths.
- When adding new plugins or filesystem access, document required permissions and defaults in `docs/` and the PR description.

## Communication

- Please respond in Chinese by default.
