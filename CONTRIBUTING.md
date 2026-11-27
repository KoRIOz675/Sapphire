# Contributing to Sapphire

Thanks for your interest in Sapphire! Bug reports, translations, documentation and code are all welcome, and you don't need to write code to help.

By participating, you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). To report a security vulnerability, **do not open a public issue**; see [SECURITY.md](./SECURITY.md).

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Making changes](#making-changes)
- [UI text](#ui-text)
- [Using AI tools](#using-ai-tools)
- [Pull request checklist](#pull-request-checklist)
- [Licensing](#licensing)
- [Maintainer notes: releases](#maintainer-notes-releases)

## Ways to contribute

- **Report a bug** or a rough edge in the UI
- **Suggest a feature** or improvement
- **Translate** the interface into a new language, or improve an existing one
- **Improve the docs**, including this file
- **Fix a bug or build a feature**; issues labelled `good first issue` are a good place to start

For anything larger than a small fix, please **open an issue first** so we can agree on the approach before you spend time on it.

## Reporting bugs

Search the [existing issues](https://github.com/KoRIOz675/Sapphire/issues) first, then open a new one with:

- What you did, what you expected, and what happened instead
- Your OS and version, and the Sapphire version (Settings or the release tag)
- Screenshots or logs if relevant

**Please do not attach your database or exports**: they may contain personal data about you and your contacts. Reproduce the problem with dummy data instead.

## Suggesting features

Open an issue describing the problem you're trying to solve, not only the solution you have in mind. Sapphire is deliberately **local-first and private**, so features that require an account, telemetry, or sending data to a server are unlikely to be accepted into the core app.

## Development setup

### Requirements

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (includes npm)
- [Rust](https://rustup.rs/) (stable toolchain)
- The [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS

### Run it

```bash
git clone https://github.com/KoRIOz675/Sapphire
cd Sapphire
npm install
npm run tauri dev
```

The first launch can take several minutes while Rust compiles all dependencies. Later launches are much faster.

### Build an installer

```bash
npm run tauri build
```

Installers are generated in `src-tauri/target/release/bundle/` (`.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux). Sapphire is built and tested on Windows and Linux; macOS may work from source but isn't supported yet.

### Where your dev data lives

By default the SQLite database is stored in the user config directory:

| OS      | Path                                                  |
| ------- | ----------------------------------------------------- |
| Windows | `%APPDATA%\fr.nbiproject.sapphire\sapphire.db`        |
| Linux   | `~/.config/fr.nbiproject.sapphire/sapphire.db`        |

The database location can be changed in Settings. Automatic backups always go to a `backups/` folder next to the database file. When testing destructive changes or migrations, **back up or point the app at a throwaway database first**.

## Project structure

```
Sapphire/
├── src/                  # Frontend: React + TypeScript
│   ├── api/              # Typed client for the Tauri commands, update check
│   ├── components/       # Reusable components
│   ├── context/          # React contexts (keyboard shortcuts)
│   ├── hooks.ts          # TanStack Query hooks over the API client
│   ├── hooks/            # Other React hooks
│   ├── pages/            # App pages
│   ├── locales/          # UI text (en.json)
│   ├── i18n.ts           # i18next configuration
│   ├── types.ts          # TS types shared with the backend
│   ├── App.tsx           # Router
│   └── main.tsx          # Vite entry point
│
└── src-tauri/            # Backend: Rust
    ├── src/
    │   ├── main.rs       # Binary entry point
    │   ├── lib.rs        # App setup + command registration
    │   ├── startup.rs    # Opens the database at launch, recovery if it fails
    │   ├── db.rs         # Opens the database and runs migrations
    │   ├── migrations/   # Numbered schema migrations
    │   ├── models.rs     # Structs mirroring the tables
    │   ├── commands/     # Handlers exposed to React via invoke()
    │   ├── error.rs      # Error type returned to the frontend
    │   ├── backup.rs     # Automatic backups
    │   ├── reminder.rs   # Background thread for native reminders
    │   ├── dialogs.rs    # Native file dialogs, opened from Rust
    │   ├── navigation.rs # Keeps the window on app pages, opens links in the browser
    │   ├── test_util.rs  # Helpers for unit tests
    │   └── schema.sql    # Baseline database schema
    ├── build.rs          # Declares the app commands for Tauri's permission system
    ├── capabilities/     # Which commands the window may call
    ├── Cargo.toml
    └── tauri.conf.json
```

## Making changes

### Workflow

1. Fork the repo and create a branch from `main` (e.g. `fix/calendar-timezone` or `feat/csv-import-tags`).
2. Make your change in small, focused commits.
3. Run the checks below locally.
4. Open a pull request against `main` and go through the [checklist](#pull-request-checklist).

### Checks your code must pass

CI runs these on every pull request, so run them locally first:

```bash
# Frontend
npx tsc --noEmit
npm test          # runs tests/*.test.ts with Node's test runner
npm run build

# Backend (from src-tauri/)
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Run `npm run build` before the `cargo` commands in a fresh checkout: the Rust build needs the `dist/` folder it produces.

### Typical change: adding or changing a backend feature

A feature that touches data usually involves the whole stack:

1. **Schema:** add a numbered migration in `src-tauri/src/migrations/mod.rs` (don't edit `schema.sql`). Never edit a migration that has already shipped.
2. **Model:** update the struct in `models.rs`.
3. **Command:** add or update the handler in `src-tauri/src/commands/`.
4. **Registration:** a new command must be listed in three places, or the frontend can't call it:
   - `tauri::generate_handler![...]` in `src-tauri/src/lib.rs`
   - the command list in `src-tauri/build.rs`
   - `"allow-<command-name>"` (kebab-case) in `src-tauri/capabilities/default.json`
5. **Types:** mirror the change in `src/types.ts`.
6. **API client:** expose the command in `src/api/tauri.ts`, and add a hook in `src/hooks.ts` if pages use it.
7. **UI:** use it from a page or component, with strings in `en.json` (see below).
8. **Tests:** add a Rust test for the backend logic where practical (`test_util::memory_db()` gives you a migrated in-memory database).

### Conventions

- **Commit messages:** `SEVERITY: type: subject`, for example `MINOR: fix: correct reminder time in calendar view`. `type` follows [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, `test`). `SEVERITY` is the impact on users:
  - `MINOR`: docs, wording, small fixes; little risk of changing behaviour
  - `MEDIUM`: new features, behaviour changes, CI or build changes
  - `CRITICAL`: database migrations or data handling, security fixes, breaking changes, repo-wide restructuring

  Pull request titles use the same format.
- **Rust:** formatted with `cargo fmt`, no Clippy warnings.
- **TypeScript:** strict typing, no `any` unless justified in a comment.
- **No hard-coded UI strings:** every user-facing string goes through i18next.
- **Local-first:** no accounts, analytics or telemetry. The only network request in the app is the update check in `src/api/updates.ts`, which is off by default and only reads the latest public release from GitHub. Don't add others.

### Design decisions worth knowing

- **Action initiator:** `Action` has no `fromPersonId`. The initiator is by definition the CRM user, whose profile (`firstName`, `lastName`, `email`) is stored in the `settings` table under the key `current_user` and edited in **Settings → User profile**.
- **Project status** is a closed list: `Active` / `Inactive`.
- **Launch backup:** a best-effort database backup runs at startup, in addition to the manual button in Settings. The number of backups kept is configurable (default 10).

## UI text

Sapphire's interface is English only. Text goes through [i18next](https://www.i18next.com/) all the same, so every string lives in `src/locales/en.json`: add new text there and use `t("...")` rather than writing it in a component.

If you'd rather not touch the code, open an issue titled "Translation: <language>" and attach the translated file; we'll wire it up.

## Using AI tools

You can use AI assistants (Copilot, ChatGPT, Claude, Cursor, Codex, etc.) to contribute, and you don't need to disclose it. One rule applies, though:

**Even if the code is written by AI, you, as a human, should be able to understand and explain it at any time.**

You are the author of what you submit. Before opening a pull request, read every line, make sure you know what it does and why it's there, and check that it matches the conventions in this file. A reviewer may ask you to explain any part of your change; "the AI wrote it" isn't an answer, and a pull request whose author can't explain it will be closed.

In practice:

- Keep AI-assisted changes small enough to review properly.
- Run the [checks](#checks-your-code-must-pass) yourself and look at the result, rather than trusting the assistant's word that they pass.
- Don't add AI co-author trailers (such as `Co-Authored-By`) to your commits.

Agents working on this repo should follow [AGENTS.md](./AGENTS.md), which summarises the project structure and the rules they must respect.

## Pull request checklist

- [ ] The PR is focused on one change, and linked to an issue if there is one
- [ ] The CI checks above pass locally
- [ ] New or changed UI text is in `src/locales/en.json`, not hard-coded
- [ ] Database changes include a migration, and existing databases keep working
- [ ] Screenshots are included for UI changes
- [ ] Docs and the README are updated if behaviour changed
- [ ] You understand every line of the change and can explain it, including any AI-generated code

## Licensing

Sapphire is licensed under the [Apache License 2.0](./LICENSE). By contributing, you agree that your contribution is licensed under the same terms (section 5 of the license), and you confirm that you have the right to submit it.

The name and logo "Sapphire" and "NBI Project" are not covered by the license (see [NOTICE](./NOTICE)); please don't use them to name a fork or imply endorsement.

## Maintainer notes: releases

Two GitHub Actions workflows live in `.github/workflows/`:

- **`ci.yml`** runs on every pull request and on pushes to `main`: type-check and Vite build, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`.
- **`release.yml`** runs on tags matching `v*` (or manually via `workflow_dispatch`). It builds with `tauri-apps/tauri-action` for Windows x64 (`.msi`, NSIS `.exe`) and Linux x64 (`.deb`, `.AppImage`), and attaches the artefacts to a **draft** GitHub Release titled "Sapphire version X.Y.Z". No secrets are needed beyond the built-in `GITHUB_TOKEN`.

Release assets always have the same names, with no version or architecture: `Sapphire.exe`, `Sapphire.msi`, `Sapphire.deb`, `Sapphire.AppImage`, plus `SHA256SUMS-Windows.txt` and `SHA256SUMS-Linux.txt`. That keeps links like `https://github.com/KoRIOz675/Sapphire/releases/latest/download/Sapphire.exe` pointing at the latest published release, so the README and [nbi-project.fr](https://nbi-project.fr/) never need updating for a new version. Don't rename them: it would break those links. Only one architecture is built per platform, and pre-releases aren't used (a pre-release is never "latest").

The draft's description is pre-filled from [`.github/RELEASE_TEMPLATE.md`](.github/RELEASE_TEMPLATE.md) (version and changelog link filled in automatically). Edit that file to change the template.

To publish a new version:

```bash
# 1. Bump the version in package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json
#    (then run `npm install` and `cargo check` so both lockfiles follow)
# 2. Commit
git commit -am "MEDIUM: chore: release v0.2.0"
# 3. Tag and push
git tag v0.2.0
git push origin main --tags
```

When the workflow finishes **for both platforms**, fill in the release notes from the template (delete empty sections) and switch the release from **Draft** to **Published**, keeping "Set as the latest release" ticked. Publishing before both builds have uploaded their files would briefly break the `latest/download` links. Only the latest version is maintained: a fix is always shipped as a new patch version, which becomes the latest release.
