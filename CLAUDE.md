# launchd-ui

macOS launchd エージェント/デーモン管理GUI（Tauri v2）

## Tech Stack

- Tauri v2 (Rust backend) + React + TypeScript + Vite
- UI: Tailwind CSS v4 + shadcn/ui
- Lint: oxlint (TypeScript), cargo clippy + rustfmt (Rust)
- Test: vitest (Frontend), cargo test (Rust)
- Package manager: pnpm

## Development Commands

- `pnpm tauri:dev` — Tauri dev (launches app with hot reload)
- `pnpm tauri:build` — Tauri production build (DMG)
- `pnpm dev` — Vite dev server only (frontend)
- `pnpm build` — TypeScript check + Vite build
- `pnpm lint` — oxlint
- `pnpm typecheck` — TypeScript type check
- `pnpm test` — vitest (frontend tests)
- `cargo test --manifest-path src-tauri/Cargo.toml` — Rust tests
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` — Rust format check
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — Rust lint

Note: `cargo tauri` is not available. Use `pnpm tauri` or `pnpm exec tauri` instead.

## Project Structure

- `src-tauri/src/` — Rust backend (launchctl wrapper, plist parsing, Tauri commands)
- `src/` — React frontend
- `src/components/ui/` — shadcn/ui components (auto-generated, do not edit manually)
- `src/lib/invoke.ts` — Typed Tauri invoke wrappers
- `src/test-utils/tauri-mock.ts` — Fake Tauri IPC for testing (not mock, but fake implementation)

## Testing

- Frontend tests use a fake Tauri IPC layer (`src/test-utils/tauri-mock.ts`) instead of mocking
- Vitest config aliases `@tauri-apps/api/core` to the fake module
- Use `setFakeHandler()` / `resetFakeHandlers()` to customize per-test behavior

## Notes

- `RUSTUP_HOME` must be explicitly set to `$HOME/.rustup` when running cargo commands in this environment
- TypeScript: use `type` not `interface`
- User agents directory: `~/Library/LaunchAgents/`
- System agents/daemons are read-only in the UI
