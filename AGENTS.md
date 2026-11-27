# AGENTS.md

Guidance for AI coding agents (Codex, Claude Code, Cursor, Copilot, etc.) working on Sapphire. Human contributors should read [CONTRIBUTING.md](./CONTRIBUTING.md); this file restates the parts an agent needs and adds the rules agents must follow.

If this file and CONTRIBUTING.md ever disagree, CONTRIBUTING.md wins. Point out the mismatch to the human you are working with.

## What Sapphire is

Sapphire is a free, open-source (Apache-2.0), **local-first networking CRM** for the desktop. It tracks people, companies, actions (calls, meetings, emails, follow-ups) and projects (campaigns such as a job search). All data lives in a local SQLite database on the user's machine.

- **No account, no server, no telemetry.** The app's only network request is an opt-in, read-only update check against the public GitHub Releases API (`src/api/updates.ts`). It is off by default.
- **Platforms:** Windows and Linux. macOS isn't supported yet.
- **Interface language:** English only, but every string still goes through i18next.
- **App identifier:** `io.github.korioz675.Sapphire` (case-sensitive; it was `fr.nbiproject.sapphire` up to 1.0.1, with no data migration). Dev and release builds store data in `~/.config/io.github.korioz675.Sapphire/` (Linux) or `%APPDATA%\io.github.korioz675.Sapphire\` (Windows).

## Tech stack

| Layer    | Technology |
| -------- | ---------- |
| Shell    | Tauri 2 |
| Backend  | Rust (edition 2021), rusqlite (bundled SQLite), serde, chrono, thiserror/anyhow |
| Frontend | React 19, TypeScript (strict), Vite, TanStack Query, React Router, Tiptap, Tailwind CSS 4, i18next, DOMPurify |
| CI       | GitHub Actions: `ci.yml`, `audit.yml`, `release.yml` |

## Repository layout

```
Sapphire/
├── src/                        # Frontend: React + TypeScript
│   ├── api/tauri.ts            # Typed wrappers around every invoke() call
│   ├── api/updates.ts          # The only network request (opt-in update check)
│   ├── hooks.ts                # TanStack Query hooks (queries + mutations) over api/
│   ├── hooks/                  # Other hooks (global shortcuts, persisted table state)
│   ├── context/                # React contexts (keyboard shortcuts)
│   ├── components/             # Reusable components, forms/, kanban/
│   ├── pages/                  # One file per route (see App.tsx)
│   ├── locales/en.json         # Every UI string
│   ├── types.ts                # TS types mirroring the Rust models (camelCase)
│   ├── i18n.ts, dates.ts, url.ts, utils.ts
│   ├── App.tsx                 # Routes
│   └── main.tsx                # Vite entry point
│
├── src-tauri/                  # Backend: Rust
│   ├── src/
│   │   ├── lib.rs              # AppState, plugin setup, command registration
│   │   ├── main.rs             # Binary entry point
│   │   ├── startup.rs          # Resolves/opens the DB at launch, recovery flow
│   │   ├── db.rs               # open_and_migrate, lock_db, id/timestamp helpers
│   │   ├── schema.sql          # Baseline schema (frozen, see rules)
│   │   ├── migrations/mod.rs   # Numbered migrations (MIGRATIONS array)
│   │   ├── models.rs           # Structs mirroring tables (serde camelCase)
│   │   ├── commands/           # #[tauri::command] handlers, one file per domain
│   │   ├── error.rs            # AppError / AppResult, serialised as a string
│   │   ├── backup.rs           # Automatic and manual backups, restore
│   │   ├── reminder.rs         # Background thread for native notifications
│   │   ├── dialogs.rs          # Native file dialogs, opened from Rust
│   │   ├── navigation.rs       # Keeps the webview on app pages; links open in the browser
│   │   ├── test_util.rs        # memory_db() for unit tests
│   │   └── list_tests.rs       # Tests for list commands
│   ├── build.rs                # Declares every app command for the permission system
│   ├── capabilities/default.json  # Grants each command (allow-<command>) to the window
│   ├── tauri.conf.json         # App config, CSP, bundle targets, version
│   └── Cargo.toml
│
├── .github/                    # Workflows, issue templates, release notes template
├── docs/                       # Images used by the README
└── CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, LICENSE, NOTICE
```

## How the pieces fit together

1. A page or component calls a hook from `src/hooks.ts`, such as `usePersons()`.
2. The hook calls `api.listPersons()` in `src/api/tauri.ts`, which runs `invoke("list_persons")`.
3. Tauri checks that `list_persons` is granted in `capabilities/default.json`, then calls the Rust command registered in `lib.rs`.
4. The command, `#[tauri::command(async)]` in `src-tauri/src/commands/`, locks the shared connection with `lock_db(&state)?` and usually delegates to a plain function that takes a `&Connection`. Those plain functions are what the unit tests exercise.
5. Results are serde structs from `models.rs` with `rename_all = "camelCase"`, which match the types in `src/types.ts`. Errors are `AppError`, serialised to a readable string for the frontend.

## Adding or changing a backend feature

A feature that touches data usually involves all of these steps:

1. **Schema:** append a numbered entry to `MIGRATIONS` in `src-tauri/src/migrations/mod.rs`. Never edit `schema.sql` or a migration that has already shipped.
2. **Model:** update the struct(s) in `models.rs`.
3. **Command:** add or update the handler in `src-tauri/src/commands/`.
4. **Register the command in three places**, or it stays uncallable:
   - `tauri::generate_handler![...]` in `src-tauri/src/lib.rs`
   - the command list in `src-tauri/build.rs`
   - `"allow-<command-name>"` (snake_case turned into kebab-case) in `src-tauri/capabilities/default.json`
5. **Types:** mirror the change in `src/types.ts`.
6. **API client:** expose it in `src/api/tauri.ts`, then add a hook in `src/hooks.ts` if pages need it (invalidate the affected query keys in mutations).
7. **UI:** use it from a page or component, with strings in `src/locales/en.json`.
8. **Tests:** add Rust unit tests for the logic, using `test_util::memory_db()` for a migrated in-memory database.

## Checks

CI (`.github/workflows/ci.yml`) runs all of these on every pull request. Run them before saying a change is done, and report the real output, including failures.

```bash
# Frontend (repo root)
npx tsc --noEmit
npm test              # node --test on tests/*.test.ts (no frontend tests exist yet)
npm run build         # also produces dist/, which the Rust build needs

# Backend (from src-tauri/)
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

Run `npm run build` at least once before `cargo` commands in a fresh checkout: `tauri::generate_context!` fails to compile without `dist/`.

`audit.yml` also runs `cargo audit` and `npm audit --omit=dev` when a lockfile changes.

## Rules

### Hard stops: never do these without explicit approval from the human

- **Commit, push, or open pull requests.** Leave your changes uncommitted in the working tree; the human reviews and commits them.
- **Bump the version or touch releases.** That covers the `version` in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, git tags, `.github/workflows/release.yml`, `.github/RELEASE_TEMPLATE.md`, and the release asset names (`Sapphire.exe`, `.msi`, `.deb`, `.rpm`, `.AppImage`, `SHA256SUMS-*.txt`; public download links depend on them).
- **Add dependencies or network access.** No new npm or Cargo dependencies, no new outbound requests, no widening of the CSP in `tauri.conf.json` or of the capabilities in `capabilities/default.json` (for example new `opener` URLs or plugin permissions).
- **Edit a shipped migration or `schema.sql`.** Schema changes go in a new numbered migration. Existing user databases must keep working.

If a task seems to need one of these, stop and ask.

### Product principles

- **Local-first and private.** No accounts, analytics, telemetry, crash reporting or cloud sync. User data never leaves the machine.
- **Never touch real user data.** Don't open, copy or modify the real database in `~/.config/io.github.korioz675.Sapphire/` (or `%APPDATA%`). For runtime testing, point the app at throwaway directories, for example by setting `XDG_CONFIG_HOME`, `XDG_DATA_HOME` and `XDG_CACHE_HOME` to a temp folder on Linux. Never commit `*.db` files or backups.

### Security conventions

- **Don't trust paths from the webview.** Commands that read or write a user-chosen file open the native dialog themselves (`dialogs.rs`) instead of taking a path argument. Commands acting on stored files take an id and resolve the path in Rust (see `open_attachment`).
- **Sanitise rendered HTML.** Rich text is rendered through DOMPurify (`MarkdownEditor.tsx`). Never add `dangerouslySetInnerHTML` without it.
- **Keep the webview on app pages.** `navigation.rs` opens http(s) links in the system browser and blocks other schemes. Don't bypass it.
- Report vulnerabilities as described in [SECURITY.md](./SECURITY.md), never in a public issue.

### Code conventions

- **Rust:** `cargo fmt`, zero Clippy warnings. Return `AppResult<T>` from commands and propagate with `?`. Don't `unwrap()`/`expect()` on user data or I/O in command paths. Use `db::new_uuid()` and `db::now_iso()` for ids and timestamps.
- **TypeScript:** strict typing. Don't use `any` unless a comment justifies it. Keep `src/types.ts` in sync with `models.rs`.
- **UI text:** every user-facing string goes in `src/locales/en.json` and is used through `t("...")`. No hard-coded strings in components.
- **Data access in React:** go through the hooks in `src/hooks.ts` (TanStack Query), not raw `invoke()` calls in components.
- **Scope:** keep changes focused on the task. Don't reformat or refactor unrelated code. Update the README, CONTRIBUTING.md or the in-app Guide (`src/pages/Guide.tsx` + `en.json`) when behaviour changes.

### Commits and pull requests (for the human, or when explicitly asked)

- **Message format:** `SEVERITY: type: subject`, for example `MINOR: docs: fix typo in README`.
  - `type` follows [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, `test`, …
  - `SEVERITY` is the change's impact on users:
    - `MINOR`: docs, wording, small fixes; little risk of changing behaviour.
    - `MEDIUM`: new features, behaviour changes, CI or build changes.
    - `CRITICAL`: database migrations or data handling, security fixes, breaking changes, repo-wide restructuring.
- **No AI attribution trailers.** Don't add `Co-Authored-By` lines or other AI attribution to commits. The human who commits is the author.
- Pull requests target `main` and follow the checklist in CONTRIBUTING.md.

### The human stays responsible

Whoever submits the change must be able to understand and explain every line of it, whether an AI wrote it or not (see "Using AI tools" in CONTRIBUTING.md). Help them: keep changes small and readable, explain what you changed and why, and flag anything you aren't sure about rather than hiding it.

## Useful facts

- **First build is slow:** `npm run tauri dev` compiles every Rust dependency the first time (several minutes).
- **Settings storage:** app settings live in the SQLite `settings` table (key/value), read and written with `get_setting`/`set_setting`. The custom database location is the exception: it's in `db_config.json` in the config dir, since it has to be read before the database is opened.
- **Current user:** the CRM user's profile is the `current_user` setting (a JSON object). `Action` has no "from person" field; the initiator is always the CRM user.
- **Backups:** a best-effort backup runs at every launch, into a `backups/` folder next to the database file. Retention is the `backup_keep` setting (default 10).
- **Dev mode:** the app runs under `React.StrictMode`, so mount effects run twice in development only.
- **Releases:** built by `release.yml` from `v*` tags only, as draft GitHub Releases that the maintainer publishes by hand. Only the latest version is maintained.
