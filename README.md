# launchd-ui

A GUI application for managing macOS launchd agents and daemons. Built with Tauri v2.

Browse user LaunchAgents (`~/Library/LaunchAgents/`) and system agents/daemons. Start, stop, restart, view/edit plist files, and create new agents.

## Tech Stack

- Tauri v2 (Rust backend) + React + TypeScript + Vite
- UI: Tailwind CSS v4 + shadcn/ui
- Lint: oxlint (TypeScript), cargo clippy + rustfmt (Rust)
- Test: vitest (Frontend), cargo test (Rust)
- Package manager: pnpm

## Development

```bash
# Install dependencies
pnpm install

# Dev mode (launches app with hot reload)
pnpm tauri:dev

# Frontend only
pnpm dev

# Production build (DMG)
pnpm tauri:build
```

## Testing / Lint

```bash
pnpm test          # vitest (frontend)
pnpm lint          # oxlint
pnpm typecheck     # TypeScript type check

cargo test --manifest-path src-tauri/Cargo.toml          # Rust tests
cargo fmt --manifest-path src-tauri/Cargo.toml --check   # Rust format check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # Rust lint
```

## License

MIT
