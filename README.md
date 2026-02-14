# launchd-ui

macOS の launchd エージェント/デーモンを管理するGUIアプリケーション。Tauri v2 で構築。

ユーザーの LaunchAgents (`~/Library/LaunchAgents/`) やシステムのエージェント/デーモンの一覧表示、起動・停止・再起動、plist の閲覧・編集、新規エージェントの作成ができる。

## Tech Stack

- Tauri v2 (Rust backend) + React + TypeScript + Vite
- UI: Tailwind CSS v4 + shadcn/ui
- Lint: oxlint (TypeScript), cargo clippy + rustfmt (Rust)
- Test: vitest (Frontend), cargo test (Rust)
- Package manager: pnpm

## Development

```bash
# 依存関係のインストール
pnpm install

# 開発（Tauri アプリとして起動、ホットリロード対応）
pnpm tauri:dev

# フロントエンドのみ起動
pnpm dev

# ビルド（DMG）
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
