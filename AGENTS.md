# Repository Guidelines

## Project Structure & Module Organization

- `src/`: React + TypeScript frontend source.
- `src-tauri/`: Tauri Rust backend (workspace member) and Tauri config.
- `public/`: Static assets served by Vite.
- `docs/`: Screenshots and documentation assets.
- `target/`: Rust build artifacts (workspace target dir).

## Build, Test, and Development Commands

- `pnpm install`: Install frontend dependencies.
- `pnpm tauri dev`: Run the desktop app in development mode (Vite + Tauri).
- `pnpm build`: Build the desktop app via Tauri.
- `pnpm web:dev`: Run the frontend only with Vite.
- `pnpm web:build`: Type-check and build the frontend bundle.
- `pnpm preview`: Preview the built frontend.
- `pnpm format`: Format frontend code with Prettier.
- `cargo fmt`: Format Rust code.

## Coding Style & Naming Conventions

- TypeScript/React: 2-space indentation, format with Prettier (`pnpm format`).
- Rust: follow `cargo fmt` output; keep functions small and explicit.
- Rust formatting/linting: Run `cargo fmt` and `cargo clippy --all-targets --all-features -- -D warnings` before opening a PR.
- Naming: use `kebab-case` for file names in `src/` when adding new files; Rust modules follow `snake_case`.
- Prefer descriptive names for Tauri commands and frontend hooks (e.g., `fetch_website_metadata`).
- Comments: Follow `cargo doc` conventions so generated docs are clear and readable; do not add meaningless comments.

## Testing Guidelines

- No automated test runner is configured yet.
- Validate changes manually by running `pnpm tauri dev` and exercising the affected UI or Tauri commands.

## Configuration & Data Paths

- App data lives under `~/.vust/vust-desk/` (config, database, and icon cache).
- If you change these paths, update user-facing docs and migration logic accordingly.

## Documentation Guidelines

- Add Chinese documentation comments for frontend/backend functions, structs, and modules; Rust docs must use `//!` and `///` and comply with `cargo doc` conventions.
- CHANGELOG entries should be user-facing; avoid implementation details and internal refactors.
- Please use Chinese for document content (including README and design documents).

## Commit & Pull Request Guidelines

- Commit messages follow a Conventional Commits-style prefix such as `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, or `build:`.
- Keep commits scoped and descriptive; separate refactors from behavior changes when possible.
Pull requests should include:
- A clear summary of user-visible changes.
- Notes on manual verification (what you tested).
- Screenshots or short clips for UI changes.

## Development Process

- If a task requires modifying more than three files, pause first and break it down into updated tasks.
- Before writing any code, please describe your proposed approach and wait for approval. If the requirements are unclear, make sure to ask clarifying questions before writing any code.

## Communication

- Please respond in chinese by default.
